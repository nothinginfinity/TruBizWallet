import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertCardSchema, insertActivitySchema, insertReminderSchema, type ScoreSnapshot } from "@shared/schema";
import { z } from "zod";

// ── Score computation helper ─────────────────────────────────────
function computeAndSaveScore() {
  const allCards = storage.getCards();
  if (!allCards.length) return;

  const totalCredit = allCards.reduce((s, c) => s + c.creditLimit, 0);
  const totalBalance = allCards.reduce((s, c) => s + c.currentBalance, 0);
  const avgUtilization = totalCredit > 0 ? (totalBalance / totalCredit) * 100 : 0;

  // Utilization score: best at <10%, degrades linearly above
  const utilScore = Math.max(0, 100 - Math.max(0, avgUtilization - 5) * 3);

  // Goal adherence: cards within their usage goal
  const onGoal = allCards.filter(c => {
    const util = c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 0;
    return util <= c.usageGoalPct;
  }).length;
  const goalScore = allCards.length > 0 ? (onGoal / allCards.length) * 100 : 100;

  const overallScore = Math.round(utilScore * 0.6 + goalScore * 0.4);

  // Preserve existing bureau scores from latest snapshot
  const existing = storage.getScoreSnapshots(1);
  const latest = existing.length > 0 ? existing[existing.length - 1] : null;

  storage.upsertScoreSnapshot({
    date: new Date().toISOString().split("T")[0],
    overallScore,
    avgUtilization,
    onTimePayments: 0,
    totalCards: allCards.length,
    totalCredit,
    totalBalance,
    sbss: latest?.sbss ?? null,
    paydex: latest?.paydex ?? null,
    intelliscore: latest?.intelliscore ?? null,
  });
}

export async function registerRoutes(server: Server, app: Express) {
  // ── Cards ──────────────────────────────────────────────────────
  app.get("/api/cards", (_req, res) => {
    res.json(storage.getCards());
  });

  app.post("/api/cards", (req, res) => {
    const parsed = insertCardSchema.safeParse({
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const card = storage.createCard(parsed.data);
    computeAndSaveScore();
    res.json(card);
  });

  app.patch("/api/cards/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const card = storage.updateCard(id, req.body);
    if (!card) return res.status(404).json({ error: "Card not found" });
    computeAndSaveScore();
    res.json(card);
  });

  app.delete("/api/cards/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    storage.deleteCard(id);
    computeAndSaveScore();
    res.json({ ok: true });
  });

  // ── Activity ───────────────────────────────────────────────────
  app.get("/api/activity", (req, res) => {
    const cardId = req.query.cardId ? parseInt(req.query.cardId as string) : undefined;
    res.json(storage.getActivity(cardId));
  });

  app.post("/api/activity", (req, res) => {
    const parsed = insertActivitySchema.safeParse({
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const entry = storage.createActivity(parsed.data);
    computeAndSaveScore();
    res.json(entry);
  });

  app.delete("/api/activity/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    storage.deleteActivity(id);
    res.json({ ok: true });
  });

  // ── Reminders ──────────────────────────────────────────────────
  app.get("/api/reminders", (req, res) => {
    const cardId = req.query.cardId ? parseInt(req.query.cardId as string) : undefined;
    res.json(storage.getReminders(cardId));
  });

  app.get("/api/reminders/upcoming", (_req, res) => {
    res.json(storage.getUpcomingReminders(7));
  });

  app.post("/api/reminders", (req, res) => {
    const parsed = insertReminderSchema.safeParse({
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createReminder(parsed.data));
  });

  app.post("/api/reminders/:id/complete", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const reminder = storage.completeReminder(id);
    if (!reminder) return res.status(404).json({ error: "Reminder not found" });
    res.json(reminder);
  });

  app.patch("/api/reminders/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const reminder = storage.updateReminder(id, req.body);
    if (!reminder) return res.status(404).json({ error: "Reminder not found" });
    res.json(reminder);
  });

  app.delete("/api/reminders/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    storage.deleteReminder(id);
    res.json({ ok: true });
  });

  // ── Score Snapshots ────────────────────────────────────────────
  app.get("/api/scores", (_req, res) => {
    res.json(storage.getScoreSnapshots(30));
  });

  // ── Update bureau scores ────────────────────────────────────────
  const scoreUpdateSchema = z.object({
    userId: z.number(),
    sbss: z.number().min(0).max(300).optional(),
    paydex: z.number().min(0).max(100).optional(),
    intelliscore: z.number().min(1).max(100).optional(),
  });

  app.post("/api/scores/update", (req, res) => {
    const parsed = scoreUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { sbss, paydex, intelliscore } = parsed.data;
    const today = new Date().toISOString().split("T")[0];

    // Get latest snapshot to base updates on
    const snapshots = storage.getScoreSnapshots(1);
    const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

    if (!latest) {
      // Create a new snapshot with just the bureau scores
      const snapshot = storage.upsertScoreSnapshot({
        date: today,
        overallScore: 0,
        avgUtilization: 0,
        onTimePayments: 0,
        totalCards: 0,
        totalCredit: 0,
        totalBalance: 0,
        sbss: sbss ?? null,
        paydex: paydex ?? null,
        intelliscore: intelliscore ?? null,
      });
      return res.json(snapshot);
    }

    const snapshot = storage.upsertScoreSnapshot({
      date: today,
      overallScore: latest.overallScore,
      avgUtilization: latest.avgUtilization,
      onTimePayments: latest.onTimePayments,
      totalCards: latest.totalCards,
      totalCredit: latest.totalCredit,
      totalBalance: latest.totalBalance,
      sbss: sbss ?? latest.sbss ?? null,
      paydex: paydex ?? latest.paydex ?? null,
      intelliscore: intelliscore ?? latest.intelliscore ?? null,
    });
    res.json(snapshot);
  });

  // ── Seed demo data (dev helper) ─────────────────────────────────
  app.post("/api/seed", (_req, res) => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split("T")[0];

    // Only seed if no cards exist
    if (storage.getCards().length > 0) {
      return res.json({ message: "Already seeded" });
    }

    const card1 = storage.createCard({
      name: "TrueBuild Starter Visa",
      issuer: "Visa",
      last4: "4821",
      cardType: "visa",
      color: "#1a1a2e",
      creditLimit: 1000,
      currentBalance: 85,
      statementBalance: 85,
      usageGoalPct: 10,
      dueDay: 15,
      reportingDay: 10,
      layer: 3,
      notes: "Starter vendor purchases",
      createdAt: now,
    });

    const card2 = storage.createCard({
      name: "TrueBuild Silver Mastercard",
      issuer: "Mastercard",
      last4: "9312",
      cardType: "mastercard",
      color: "#16213e",
      creditLimit: 5000,
      currentBalance: 420,
      statementBalance: 420,
      usageGoalPct: 10,
      dueDay: 20,
      reportingDay: 15,
      layer: 4,
      notes: "Software subscriptions",
      createdAt: now,
    });

    const card3 = storage.createCard({
      name: "TrueBuild Gold Amex",
      issuer: "American Express",
      last4: "0077",
      cardType: "amex",
      color: "#0f3460",
      creditLimit: 10000,
      currentBalance: 750,
      statementBalance: 750,
      usageGoalPct: 10,
      dueDay: 25,
      reportingDay: 20,
      layer: 5,
      notes: "Travel & entertainment",
      createdAt: now,
    });

    const card4 = storage.createCard({
      name: "TrueBuild Platinum Visa",
      issuer: "Visa",
      last4: "5563",
      cardType: "visa",
      color: "#533483",
      creditLimit: 25000,
      currentBalance: 1800,
      statementBalance: 1800,
      usageGoalPct: 10,
      dueDay: 10,
      reportingDay: 5,
      layer: 6,
      notes: "High-limit strategic spend",
      createdAt: now,
    });

    const card5 = storage.createCard({
      name: "TrueBuild Elite Mastercard",
      issuer: "Mastercard",
      last4: "8841",
      cardType: "mastercard",
      color: "#1b1b2f",
      creditLimit: 50000,
      currentBalance: 3200,
      statementBalance: 3200,
      usageGoalPct: 10,
      dueDay: 5,
      reportingDay: 1,
      layer: 7,
      notes: "Capital access line",
      createdAt: now,
    });

    // Sample activity
    storage.createActivity({ cardId: card1.id, type: "spend", amount: 85, merchant: "Staples", note: "Office supplies", date: today, createdAt: now });
    storage.createActivity({ cardId: card2.id, type: "spend", amount: 220, merchant: "AWS", note: "Monthly cloud bill", date: today, createdAt: now });
    storage.createActivity({ cardId: card2.id, type: "spend", amount: 200, merchant: "Adobe", note: "Annual subscription", date: today, createdAt: now });
    storage.createActivity({ cardId: card3.id, type: "spend", amount: 750, merchant: "Delta Airlines", note: "Business travel", date: today, createdAt: now });
    storage.createActivity({ cardId: card4.id, type: "spend", amount: 1800, merchant: "Equipment Direct", note: "Office equipment", date: today, createdAt: now });
    storage.createActivity({ cardId: card5.id, type: "spend", amount: 3200, merchant: "Trade Show Intl", note: "Conference booth", date: today, createdAt: now });

    // Sample reminders
    storage.createReminder({ cardId: card1.id, type: "payment", title: "Pay TrueBuild Starter balance", dueDay: 15, amount: 85, recurring: true, completed: false, createdAt: now });
    storage.createReminder({ cardId: card2.id, type: "payment", title: "Pay TrueBuild Silver balance", dueDay: 20, amount: 420, recurring: true, completed: false, createdAt: now });
    storage.createReminder({ cardId: card3.id, type: "spend", title: "Use Gold Amex for travel", dueDay: null, amount: 50, recurring: true, completed: false, createdAt: now });
    storage.createReminder({ cardId: null, type: "custom", title: "Review NAV credit report", dueDay: 1, amount: null, recurring: true, completed: false, createdAt: now });

    computeAndSaveScore();

    // Seed bureau scores on today's snapshot
    storage.upsertScoreSnapshot({
      date: today,
      overallScore: storage.getScoreSnapshots(1).reverse()[0]?.overallScore ?? 80,
      avgUtilization: storage.getScoreSnapshots(1).reverse()[0]?.avgUtilization ?? 5,
      onTimePayments: 0,
      totalCards: 5,
      totalCredit: 91000,
      totalBalance: 6255,
      sbss: 185,
      paydex: 80,
      intelliscore: 72,
    });

    res.json({ message: "Seeded", cards: 5 });
  });
}
