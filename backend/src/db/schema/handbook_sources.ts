import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { handbookEditionsTable } from "./handbook_editions";

export const handbookSourcesTable = pgTable("handbook_sources", {
  id: serial("id").primaryKey(),
  editionId: integer("edition_id").notNull().references(() => handbookEditionsTable.id, { onDelete: "restrict" }),
  language: text("language").notNull(),
  fileName: text("file_name").notNull(),
  sourceUrl: text("source_url"),
  checksum: text("checksum"),
  extractedAt: timestamp("extracted_at").notNull().defaultNow(),
});
