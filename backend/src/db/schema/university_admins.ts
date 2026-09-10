import { pgTable, serial, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { universitiesTable } from "./universities";

export const universityAdminsTable = pgTable(
  "university_admins",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    universityId: integer("university_id")
      .notNull()
      .references(() => universitiesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("university_admins_user_university_idx").on(t.userId, t.universityId),
    index("university_admins_university_id_idx").on(t.universityId),
  ],
);

export type UniversityAdmin = typeof universityAdminsTable.$inferSelect;
