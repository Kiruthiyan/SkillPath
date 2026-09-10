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
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  address: text("address"),
  // pending_verification | verified | published | suspended | archived — set only by admin/super_admin.
  // Defaults to "published" at the DB level so pre-existing catalog rows stay visible; new rows created
  // through the admin flow explicitly set their own initial status.
  status: text("status").notNull().default("published"),
});
