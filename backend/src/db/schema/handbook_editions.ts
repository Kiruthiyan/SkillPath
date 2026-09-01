import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const handbookEditionsTable = pgTable("handbook_editions", {
  id: serial("id").primaryKey(),
  academicYear: text("academic_year").notNull().unique(),
  sourceUrl: text("source_url"),
  language: text("language"),
  totalPages: integer("total_pages"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
});
