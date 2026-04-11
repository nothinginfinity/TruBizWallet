import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertCardSchema, insertActivitySchema, insertReminderSchema } from "@shared/schema";
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

  storage.upsertScoreSnapshot({
    date: new Date().toISOString().split("T")[0],
    overallScore,
    avgUtilization,
    onTimePayments: 0,
    totalCards: allCards.length,
    totalCredit,
    totalBalance,
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

  // ── Seed demo data (dev helper) ─────────────────────────────────
  app.post("/api/seed", (_req, res) => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split("T")[0];

    // Only seed if no cards exist
    if (storage.getCards().length > 0) {
      return res.json({ message: "Already seeded" });
    }

    const card1 = storage.createCard({
      name: "Chase Ink Business Cash",
      issuer: "Chase",
      last4: "4821",
      cardType: "visa",
      color: "#1a3a5c",
      creditLimit: 5000,
      currentBalance: 380,
      statementBalance: 380,
      usageGoalPct: 10,
      dueDay: 15,
      reportingDay: 10,
      layer: 3,
      notes: "Primary vendor purchases",
      createdAt: now,
    });

    const card2 = storage.createCard({
      name: "Brex Business Card",
      issuer: "Brex",
      last4: "9312",
      cardType: "mastercard",
      color: "#7c3aed",
      creditLimit: 10000,
      currentBalance: 720,
      statementBalance: 720,
      usageGoalPct: 10,
      dueDay: 20,
      reportingDay: 15,
      layer: 4,
      notes: "Software subscriptions only",
      createdAt: now,
    });

    const card3 = storage.createCard({
      name: "Capital One Spark",
      issuer: "Capital One",
      last4: "0077",
      cardType: "mastercard",
      color: "#b45309",
      creditLimit: 8000,
      currentBalance: 200,
      statementBalance: 200,
      usageGoalPct: 10,
      dueDay: 25,
      reportingDay: 20,
      layer: 5,
      notes: "Travel & entertainment",
      createdAt: now,
    });

    // Sample activity
    storage.createActivity({ cardId: card1.id, type: "spend", amount: 180, merchant: "Staples", note: "Office supplies", date: today, createdAt: now });
    storage.createActivity({ cardId: card1.id, type: "spend", amount: 200, merchant: "Amazon Business", note: "Supplies", date: today, createdAt: now });
    storage.createActivity({ cardId: card2.id, type: "spend", amount: 720, merchant: "AWS", note: "Monthly cloud bill", date: today, createdAt: now });
    storage.createActivity({ cardId: card3.id, type: "spend", amount: 200, merchant: "Delta Airlines", note: "Business travel", date: today, createdAt: now });

    // Sample reminders
    storage.createReminder({ cardId: card1.id, type: "payment", title: "Pay Chase Ink balance", dueDay: 15, amount: 380, recurring: true, completed: false, createdAt: now });
    storage.createReminder({ cardId: card2.id, type: "payment", title: "Pay Brex balance", dueDay: 20, amount: 720, recurring: true, completed: false, createdAt: now });
    storage.createReminder({ cardId: card3.id, type: "spend", title: "Use Spark for travel booking", dueDay: null, amount: 50, recurring: true, completed: false, createdAt: now });
    storage.createReminder({ cardId: null, type: "custom", title: "Review NAV credit report", dueDay: 1, amount: null, recurring: true, completed: false, createdAt: now });

    computeAndSaveScore();

    res.json({ message: "Seeded", cards: 3 });
  });
}
