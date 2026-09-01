import { pgTable, serial, text, integer, boolean, real } from "drizzle-orm/pg-core";

export const alumniReviewsTable = pgTable("alumni_reviews", {
  id: serial("id").primaryKey(),
  reviewerName: text("reviewer_name").notNull(),
  universityId: integer("university_id").notNull(),
  courseId: integer("course_id").notNull(),
  graduationYear: integer("graduation_year").notNull(),
  currentPosition: text("current_position").notNull(),
  company: text("company").notNull(),
  reviewText: text("review_text").notNull(),
  rating: real("rating").default(5),
  isVerified: boolean("is_verified").notNull().default(false),
  avatarColor: text("avatar_color"),
});
