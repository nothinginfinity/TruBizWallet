import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import {
  cards, activity, reminders, scoreSnapshots,
  type Card, type InsertCard,
  type Activity, type InsertActivity,
  type Reminder, type InsertReminder,
  type ScoreSnapshot, type InsertScoreSnapshot,
} from "@shared/schema";

export interface IStorage {
  // Cards
  getCards(): Card[];
  getCard(id: number): Card | undefined;
  createCard(card: InsertCard): Card;
  updateCard(id: number, updates: Partial<InsertCard>): Card | undefined;
  deleteCard(id: number): void;

  // Activity
  getActivity(cardId?: number, limit?: number): Activity[];
  createActivity(entry: InsertActivity): Activity;
  deleteActivity(id: number): void;

  // Reminders
  getReminders(cardId?: number): Reminder[];
  getUpcomingReminders(days?: number): Reminder[];
  createReminder(reminder: InsertReminder): Reminder;
  completeReminder(id: number): Reminder | undefined;
  updateReminder(id: number, updates: Partial<InsertReminder>): Reminder | undefined;
  deleteReminder(id: number): void;

  // Score snapshots
  getScoreSnapshots(limit?: number): ScoreSnapshot[];
  upsertScoreSnapshot(snapshot: InsertScoreSnapshot): ScoreSnapshot;
}

export class DatabaseStorage implements IStorage {
  // ── Cards ──────────────────────────────────────────────────────
  getCards(): Card[] {
    return db.select().from(cards).orderBy(cards.layer, cards.name).all();
  }
  getCard(id: number): Card | undefined {
    return db.select().from(cards).where(eq(cards.id, id)).get();
  }
  createCard(card: InsertCard): Card {
    return db.insert(cards).values(card).returning().get();
  }
  updateCard(id: number, updates: Partial<InsertCard>): Card | undefined {
    db.update(cards).set(updates).where(eq(cards.id, id)).run();
    return this.getCard(id);
  }
  deleteCard(id: number): void {
    db.delete(cards).where(eq(cards.id, id)).run();
  }

  // ── Activity ───────────────────────────────────────────────────
  getActivity(cardId?: number, limit = 50): Activity[] {
    let query = db.select().from(activity).orderBy(desc(activity.date));
    if (cardId !== undefined) {
      return db.select().from(activity)
        .where(eq(activity.cardId, cardId))
        .orderBy(desc(activity.date))
        .limit(limit)
        .all();
    }
    return query.limit(limit).all();
  }
  createActivity(entry: InsertActivity): Activity {
    const result = db.insert(activity).values(entry).returning().get();
    // Update card balance
    const card = this.getCard(entry.cardId);
    if (card) {
      const delta = entry.type === "payment" ? -entry.amount : entry.amount;
      const newBalance = Math.max(0, card.currentBalance + delta);
      this.updateCard(entry.cardId, { currentBalance: newBalance });
    }
    return result;
  }
  deleteActivity(id: number): void {
    db.delete(activity).where(eq(activity.id, id)).run();
  }

  // ── Reminders ──────────────────────────────────────────────────
  getReminders(cardId?: number): Reminder[] {
    if (cardId !== undefined) {
      return db.select().from(reminders)
        .where(eq(reminders.cardId, cardId))
        .orderBy(reminders.dueDay)
        .all();
    }
    return db.select().from(reminders).orderBy(reminders.dueDay).all();
  }
  getUpcomingReminders(days = 7): Reminder[] {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + days);
    // For day-of-month reminders, surface those due in the next N days
    return db.select().from(reminders)
      .where(eq(reminders.completed, false))
      .orderBy(reminders.dueDay)
      .all();
  }
  createReminder(reminder: InsertReminder): Reminder {
    return db.insert(reminders).values(reminder).returning().get();
  }
  completeReminder(id: number): Reminder | undefined {
    db.update(reminders).set({
      completed: true,
      completedAt: new Date().toISOString(),
    }).where(eq(reminders.id, id)).run();
    return db.select().from(reminders).where(eq(reminders.id, id)).get();
  }
  updateReminder(id: number, updates: Partial<InsertReminder>): Reminder | undefined {
    db.update(reminders).set(updates).where(eq(reminders.id, id)).run();
    return db.select().from(reminders).where(eq(reminders.id, id)).get();
  }
  deleteReminder(id: number): void {
    db.delete(reminders).where(eq(reminders.id, id)).run();
  }

  // ── Score Snapshots ────────────────────────────────────────────
  getScoreSnapshots(limit = 30): ScoreSnapshot[] {
    return db.select().from(scoreSnapshots)
      .orderBy(desc(scoreSnapshots.date))
      .limit(limit)
      .all()
      .reverse();
  }
  upsertScoreSnapshot(snapshot: InsertScoreSnapshot): ScoreSnapshot {
    const existing = db.select().from(scoreSnapshots)
      .where(eq(scoreSnapshots.date, snapshot.date))
      .get();
    if (existing) {
      db.update(scoreSnapshots).set(snapshot)
        .where(eq(scoreSnapshots.date, snapshot.date)).run();
      return db.select().from(scoreSnapshots)
        .where(eq(scoreSnapshots.date, snapshot.date)).get()!;
    }
    return db.insert(scoreSnapshots).values(snapshot).returning().get();
  }
}

export const storage = new DatabaseStorage();
