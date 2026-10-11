import { pgTable, serial, text, real, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  stream: text("stream"),
  zscore: real("zscore"),
  district: text("district"),
  language: text("language").default("en"),
  role: text("role").notNull().default("student"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resetOtpHash: text("reset_otp_hash"),
  resetOtpExpiresAt: timestamp("reset_otp_expires_at"),
  resetOtpAttempts: integer("reset_otp_attempts").notNull().default(0),
  resetOtpRequestedAt: timestamp("reset_otp_requested_at"),
  googleId: text("google_id").unique(),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  // Bumped whenever the password changes, so previously issued JWTs stop working.
  tokenVersion: integer("token_version").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  role: true,
  tokenVersion: true,
  resetOtpHash: true,
  resetOtpExpiresAt: true,
  resetOtpAttempts: true,
  resetOtpRequestedAt: true,
  mustChangePassword: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
