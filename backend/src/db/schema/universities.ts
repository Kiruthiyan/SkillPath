import { pgTable, serial, text, integer, jsonb } from "drizzle-orm/pg-core";

export interface UniversityTranslation {
  name?: string;
  description?: string;
}

export type UniversityTranslations = Partial<
  Record<"en" | "si" | "ta", UniversityTranslation>
>;

export const universitiesTable = pgTable("universities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  location: text("location").notNull(),
  foundedYear: integer("founded_year").notNull(),
  logoColor: text("logo_color").notNull(),
  ranking: integer("ranking").notNull(),
  description: text("description"),
  translations: jsonb("translations").$type<UniversityTranslations>(),
});
