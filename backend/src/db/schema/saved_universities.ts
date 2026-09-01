import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const savedUniversitiesTable = pgTable(
  "saved_universities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    universityId: integer("university_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.universityId)],
);
