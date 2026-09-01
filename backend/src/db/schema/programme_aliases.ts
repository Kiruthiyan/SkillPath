import { index, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { degreeProgrammesTable } from "./degree_programmes";

export const programmeAliasesTable = pgTable(
  "programme_aliases",
  {
    id: serial("id").primaryKey(),
    programmeId: integer("programme_id").notNull().references(() => degreeProgrammesTable.id, { onDelete: "restrict" }),
    aliasName: text("alias_name").notNull(),
    academicYear: text("academic_year"),
    source: text("source").notNull(),
    status: text("status").notNull().default("suggested"),
    confidence: integer("confidence").notNull(),
    matchReason: text("match_reason").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("programme_aliases_programme_id_alias_year_source_unique").on(
      table.programmeId,
      table.aliasName,
      table.academicYear,
      table.source,
    ),
    index("programme_aliases_programme_id_idx").on(table.programmeId),
    index("programme_aliases_academic_year_idx").on(table.academicYear),
    index("programme_aliases_status_idx").on(table.status),
    index("programme_aliases_alias_name_idx").on(table.aliasName),
  ],
);
