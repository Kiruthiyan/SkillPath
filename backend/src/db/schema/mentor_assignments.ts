import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// requested | accepted | declined | active | completed | cancelled
export const MENTOR_ASSIGNMENT_STATUSES = [
  "requested",
  "accepted",
  "declined",
  "active",
  "completed",
  "cancelled",
] as const;

export const mentorAssignmentsTable = pgTable(
  "mentor_assignments",
  {
    id: serial("id").primaryKey(),
    mentorUserId: integer("mentor_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    studentUserId: integer("student_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("requested"),
    message: text("message"),
    // Future-payment-readiness: nullable, unenforced in v1. Keeps schema open for a later
    // mentor_payments table FK'd to this row without needing another migration.
    billingPlan: text("billing_plan"),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    respondedAt: timestamp("responded_at"),
    endedAt: timestamp("ended_at"),
  },
  (t) => [
    index("mentor_assignments_mentor_idx").on(t.mentorUserId),
    index("mentor_assignments_student_idx").on(t.studentUserId),
  ],
);

export type MentorAssignment = typeof mentorAssignmentsTable.$inferSelect;
