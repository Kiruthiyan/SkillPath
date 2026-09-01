import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const successStoriesTable = pgTable("success_stories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  courseId: integer("course_id").notNull(),
  graduationYear: integer("graduation_year").notNull(),
  currentPosition: text("current_position").notNull(),
  summary: text("summary"),
  careerJourney: text("career_journey"),
  avatarColor: text("avatar_color"),
});
