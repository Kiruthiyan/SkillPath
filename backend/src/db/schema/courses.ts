import { pgTable, serial, text, integer, real } from "drizzle-orm/pg-core";
import { degreeProgrammesTable } from "./degree_programmes";
import { universitiesTable } from "./universities";

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  universityId: integer("university_id").notNull().references(() => universitiesTable.id, { onDelete: "restrict" }),
  degreeName: text("degree_name").notNull(),
  faculty: text("faculty").notNull(),
  degreeType: text("degree_type").notNull(),
  durationYears: integer("duration_years").notNull(),
  minimumZScore: real("minimum_z_score").notNull(),
  stream: text("stream").notNull(),
  description: text("description"),
  subjects: text("subjects"),
  skillsDeveloped: text("skills_developed"),
  programmeId: integer("programme_id").references(() => degreeProgrammesTable.id, { onDelete: "set null" }),
});
