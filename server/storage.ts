import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import {
  cards, activity, reminders, scoreSnapshots, clients, reimbursements,
  type Card, type InsertCard,
  type Activity, type InsertActivity,
  type Reminder, type InsertReminder,
  type ScoreSnapshot, type InsertScoreSnapshot,
  type Client, type InsertClient,
  type Reimbursement, type InsertReimbursement,
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
  getReimbursableActivity(): Activity[];
  createActivity(entry: InsertActivity): Activity;
  updateActivity(id: number, updates: Partial<InsertActivity>): Activity | undefined;
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

  // Clients
  getClients(): Client[];
  getClient(id: number): Client | undefined;
  createClient(client: InsertClient): Client;
  updateClient(id: number, updates: Partial<InsertClient>): Client | undefined;
  deleteClient(id: number): void;

  // Reimbursements
  getReimbursements(status?: string): Reimbursement[];
  getReimbursement(id: number): Reimbursement | undefined;
  createReimbursement(r: InsertReimbursement): Reimbursement;
  updateReimbursement(id: number, updates: Partial<InsertReimbursement>): Reimbursement | undefined;
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
    if (cardId !== undefined) {
      return db.select().from(activity)
        .where(eq(activity.cardId, cardId))
        .orderBy(desc(activity.date))
        .limit(limit)
        .all();
    }
    return db.select().from(activity).orderBy(desc(activity.date)).limit(limit).all();
  }
  getReimbursableActivity(): Activity[] {
    return db.select().from(activity)
      .where(eq(activity.reimbursable, true))
      .orderBy(desc(activity.date))
      .all();
  }
  createActivity(entry: InsertActivity): Activity {
    const result = db.insert(activity).values(entry).returning().get();
    const card = this.getCard(entry.cardId);
    if (card) {
      const delta = entry.type === "payment" ? -entry.amount : entry.amount;
      const newBalance = Math.max(0, card.currentBalance + delta);
      this.updateCard(entry.cardId, { currentBalance: newBalance });
    }
    return result;
  }
  updateActivity(id: number, updates: Partial<InsertActivity>): Activity | undefined {
    db.update(activity).set(updates).where(eq(activity.id, id)).run();
    return db.select().from(activity).where(eq(activity.id, id)).get();
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

  // ── Clients ────────────────────────────────────────────────────
  getClients(): Client[] {
    return db.select().from(clients).orderBy(clients.name).all();
  }
  getClient(id: number): Client | undefined {
    return db.select().from(clients).where(eq(clients.id, id)).get();
  }
  createClient(client: InsertClient): Client {
    return db.insert(clients).values(client).returning().get();
  }
  updateClient(id: number, updates: Partial<InsertClient>): Client | undefined {
    db.update(clients).set(updates).where(eq(clients.id, id)).run();
    return this.getClient(id);
  }
  deleteClient(id: number): void {
    db.delete(clients).where(eq(clients.id, id)).run();
  }

  // ── Reimbursements ─────────────────────────────────────────────
  getReimbursements(status?: string): Reimbursement[] {
    if (status) {
      return db.select().from(reimbursements)
        .where(eq(reimbursements.status, status))
        .orderBy(desc(reimbursements.createdAt))
        .all();
    }
    return db.select().from(reimbursements)
      .orderBy(desc(reimbursements.createdAt))
      .all();
  }
  getReimbursement(id: number): Reimbursement | undefined {
    return db.select().from(reimbursements).where(eq(reimbursements.id, id)).get();
  }
  createReimbursement(r: InsertReimbursement): Reimbursement {
    return db.insert(reimbursements).values(r).returning().get();
  }
  updateReimbursement(id: number, updates: Partial<InsertReimbursement>): Reimbursement | undefined {
    db.update(reimbursements).set(updates).where(eq(reimbursements.id, id)).run();
    return this.getReimbursement(id);
  }
}

export const storage = new DatabaseStorage();
