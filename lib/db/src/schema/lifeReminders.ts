import { createInsertSchema } from "drizzle-zod";
import { boolean, date, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type ReminderTask = {
  id: string;
  title: string;
  date: string;
  done: boolean;
};

export type ReminderModule = {
  id: string;
  category: string;
  title: string;
  moduleNumber: number;
  done: boolean;
};

export const lifeReminderConfigs = pgTable("life_reminder_configs", {
  userId: text("user_id").primaryKey(),
  botTokenCiphertext: text("bot_token_ciphertext"),
  chatId: text("chat_id").notNull(),
  time: text("reminder_time").notNull().default("09:00"),
  timezone: text("timezone").notNull().default("Asia/Dubai"),
  enabled: boolean("enabled").notNull().default(false),
  tasks: jsonb("tasks").$type<ReminderTask[]>().notNull().default([]),
  modules: jsonb("modules").$type<ReminderModule[]>().notNull().default([]),
  lastSentDate: date("last_sent_date", { mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLifeReminderConfigSchema = createInsertSchema(lifeReminderConfigs);
export type InsertLifeReminderConfig = typeof lifeReminderConfigs.$inferInsert;
export type LifeReminderConfig = typeof lifeReminderConfigs.$inferSelect;
