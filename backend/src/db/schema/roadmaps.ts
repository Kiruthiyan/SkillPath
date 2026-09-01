import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const roadmapsTable = pgTable("roadmaps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
