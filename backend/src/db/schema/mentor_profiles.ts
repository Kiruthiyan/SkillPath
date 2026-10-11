import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// pending | verified | rejected | suspended — set only by admin/super_admin.
export const MENTOR_VERIFICATION_STATUSES = ["pending", "verified", "rejected", "suspended"] as const;

export const mentorProfilesTable = pgTable("mentor_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  headline: text("headline"),
  bio: text("bio"),
  expertiseAreas: jsonb("expertise_areas").$type<string[]>(),
  yearsExperience: integer("years_experience"),
  availability: text("availability"),
  isAcceptingStudents: boolean("is_accepting_students").notNull().default(true),
  verificationStatus: text("verification_status").notNull().default("pending"),
  verifiedByUserId: integer("verified_by_user_id").references(() => usersTable.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MentorProfile = typeof mentorProfilesTable.$inferSelect;
