import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Credit Cards (wallet) ────────────────────────────────────────
export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),              // "Chase Ink Business Cash"
  issuer: text("issuer").notNull(),          // "Chase"
  last4: text("last4").notNull(),            // "4812"
  cardType: text("card_type").notNull(),     // "visa" | "mastercard" | "amex" | "discover" | "other"
  color: text("color").notNull(),            // hex or tailwind class
  creditLimit: real("credit_limit").notNull(),
  currentBalance: real("current_balance").notNull().default(0),
  statementBalance: real("statement_balance").notNull().default(0),
  usageGoalPct: real("usage_goal_pct").notNull().default(10), // target utilization %
  dueDay: integer("due_day").notNull(),      // day of month payment is due
  reportingDay: integer("reporting_day").notNull().default(1), // when issuer reports to bureaus
  layer: integer("layer").notNull().default(1),              // 1-7 TrueBuild layer
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const insertCardSchema = createInsertSchema(cards).omit({ id: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;

// ── Activity (spending / payment log) ───────────────────────────
export const activity = sqliteTable("activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id").notNull(),
  type: text("type").notNull(),     // "spend" | "payment" | "statement"
  amount: real("amount").notNull(),
  merchant: text("merchant"),
  note: text("note"),
  date: text("date").notNull(),     // ISO string
  createdAt: text("created_at").notNull(),
});

export const insertActivitySchema = createInsertSchema(activity).omit({ id: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activity.$inferSelect;

// ── Reminders ────────────────────────────────────────────────────
export const reminders = sqliteTable("reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id"),        // null = global
  type: text("type").notNull(),      // "payment" | "spend" | "reporting" | "custom"
  title: text("title").notNull(),
  dueDay: integer("due_day"),        // day of month, if recurring
  dueDate: text("due_date"),         // specific date, if one-time
  amount: real("amount"),            // suggested amount (e.g. min payment)
  recurring: integer("recurring", { mode: "boolean" }).notNull().default(true),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});

export const insertReminderSchema = createInsertSchema(reminders).omit({ id: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;

// ── Score snapshots (daily roll-up for the scoreboard chart) ─────
export const scoreSnapshots = sqliteTable("score_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),   // YYYY-MM-DD
  overallScore: real("overall_score").notNull(),   // 0-100
  avgUtilization: real("avg_utilization").notNull(),
  onTimePayments: integer("on_time_payments").notNull().default(0),
  totalCards: integer("total_cards").notNull().default(0),
  totalCredit: real("total_credit").notNull().default(0),
  totalBalance: real("total_balance").notNull().default(0),
});

export const insertScoreSnapshotSchema = createInsertSchema(scoreSnapshots).omit({ id: true });
export type InsertScoreSnapshot = z.infer<typeof insertScoreSnapshotSchema>;
export type ScoreSnapshot = typeof scoreSnapshots.$inferSelect;
