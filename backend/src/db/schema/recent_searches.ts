import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const recentSearchesTable = pgTable("recent_searches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  query: text("query").notNull(),
  filters: text("filters"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
