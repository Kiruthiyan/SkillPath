import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { universitiesTable } from "./universities";

export const OPPORTUNITY_TYPES = ["scholarship", "internship", "competition", "grant", "other"] as const;

export const OPPORTUNITY_STATUSES = [
  "draft",
  "pending_verification",
  "verified",
  "published",
  "unpublished",
  "archived",
] as const;

export interface OpportunityTranslation {
  title?: string;
  description?: string;
}

export type OpportunityTranslations = Partial<Record<"en" | "si" | "ta", OpportunityTranslation>>;

export const opportunitiesTable = pgTable(
  "opportunities",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    organization: text("organization"),
    universityId: integer("university_id").references(() => universitiesTable.id, { onDelete: "set null" }),
    eligibilityStream: text("eligibility_stream"),
    eligibilityNotes: text("eligibility_notes"),
    applicationUrl: text("application_url"),
    applicationDeadline: timestamp("application_deadline"),
    amount: text("amount"),
    status: text("status").notNull().default("draft"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id),
    reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id),
    reviewedAt: timestamp("reviewed_at"),
    translations: jsonb("translations").$type<OpportunityTranslations>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("opportunities_status_idx").on(t.status),
    index("opportunities_type_idx").on(t.type),
    index("opportunities_university_id_idx").on(t.universityId),
  ],
);

export type Opportunity = typeof opportunitiesTable.$inferSelect;
