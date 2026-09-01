import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const savedCoursesTable = pgTable(
  "saved_courses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    courseId: integer("course_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.courseId)],
);
