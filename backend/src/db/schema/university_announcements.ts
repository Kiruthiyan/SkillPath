import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { universitiesTable } from "./universities";

export const universityAnnouncementsTable = pgTable(
  "university_announcements",
  {
    id: serial("id").primaryKey(),
    universityId: integer("university_id")
      .notNull()
      .references(() => universitiesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("university_announcements_university_id_idx").on(t.universityId)],
);

export type UniversityAnnouncement = typeof universityAnnouncementsTable.$inferSelect;
