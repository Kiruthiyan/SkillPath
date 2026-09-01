import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const careerPathsTable = pgTable("career_paths", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  degreeType: text("degree_type").notNull(),
  salaryMin: integer("salary_min").notNull(),
  salaryMax: integer("salary_max").notNull(),
  currency: text("currency").default("LKR"),
  growthPotential: text("growth_potential").notNull(),
  industryDemand: text("industry_demand").notNull(),
  description: text("description"),
});
