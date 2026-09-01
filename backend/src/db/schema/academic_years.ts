import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { handbookSourcesTable } from "./handbook_sources";

export const academicYearsTable = pgTable("academic_years", {
  id: serial("id").primaryKey(),
  academicYear: text("academic_year").notNull().unique(),
  handbookAvailable: boolean("handbook_available").notNull().default(false),
  sourceHandbookId: integer("source_handbook_id").references(() => handbookSourcesTable.id, { onDelete: "set null" }),
  publishedDate: timestamp("published_date"),
});
