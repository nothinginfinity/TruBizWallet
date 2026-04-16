import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Cards
export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  issuer: text("issuer").notNull(),
  last4: text("last4").notNull(),
  cardType: text("card_type").notNull(),
  color: text("color").notNull(),
  creditLimit: real("credit_limit").notNull(),
  currentBalance: real("current_balance").notNull().default(0),
  statementBalance: real("statement_balance").notNull().default(0),
  usageGoalPct: real("usage_goal_pct").notNull().default(10),
  dueDay: integer("due_day").notNull(),
  reportingDay: integer("reporting_day").notNull().default(1),
  layer: integer("layer").notNull().default(1),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertCardSchema = createInsertSchema(cards).omit({ id: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;

// Activity (extended for V1 Smart Spend)
export const activity = sqliteTable("activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  merchant: text("merchant"),
  note: text("note"),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
  // V1 Smart Spend fields
  clientId: integer("client_id"),
  reimbursable: integer("reimbursable", { mode: "boolean" }).notNull().default(false),
  reimbursementStatus: text("reimbursement_status").notNull().default("none"),
  reimbursementSentAt: text("reimbursement_sent_at"),
  reimbursementReceivedAt: text("reimbursement_received_at"),
  reimbursementAmount: real("reimbursement_amount"),
  locationName: text("location_name"),
  locationLat: real("location_lat"),
  locationLng: real("location_lng"),
  merchantCategory: text("merchant_category").notNull().default("other"),
});
export const insertActivitySchema = createInsertSchema(activity).omit({ id: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activity.$inferSelect;

// Reminders
export const reminders = sqliteTable("reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  dueDay: integer("due_day"),
  dueDate: text("due_date"),
  amount: real("amount"),
  recurring: integer("recurring", { mode: "boolean" }).notNull().default(true),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});
export const insertReminderSchema = createInsertSchema(reminders).omit({ id: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;

// Score Snapshots
export const scoreSnapshots = sqliteTable("score_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  overallScore: real("overall_score").notNull(),
  avgUtilization: real("avg_utilization").notNull(),
  onTimePayments: integer("on_time_payments").notNull().default(0),
  totalCards: integer("total_cards").notNull().default(0),
  totalCredit: real("total_credit").notNull().default(0),
  totalBalance: real("total_balance").notNull().default(0),
});
export const insertScoreSnapshotSchema = createInsertSchema(scoreSnapshots).omit({ id: true });
export type InsertScoreSnapshot = z.infer<typeof insertScoreSnapshotSchema>;
export type ScoreSnapshot = typeof scoreSnapshots.$inferSelect;

// Clients (V1 Smart Spend)
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  zelleHandle: text("zelle_handle"),
  venmoHandle: text("venmo_handle"),
  preferredPayment: text("preferred_payment").notNull().default("zelle"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Reimbursements (V1 Smart Spend)
export const reimbursements = sqliteTable("reimbursements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  activityId: integer("activity_id").notNull(),
  clientId: integer("client_id").notNull(),
  amount: real("amount").notNull(),
  method: text("method").notNull().default("zelle"),
  status: text("status").notNull().default("draft"),
  sentAt: text("sent_at"),
  paidAt: text("paid_at"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertReimbursementSchema = createInsertSchema(reimbursements).omit({ id: true });
export type InsertReimbursement = z.infer<typeof insertReimbursementSchema>;
export type Reimbursement = typeof reimbursements.$inferSelect;
