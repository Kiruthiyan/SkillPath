import { index, pgTable, serial, integer, text, real, unique } from "drizzle-orm/pg-core";
import { degreeProgrammesTable } from "./degree_programmes";
import { handbookEditionsTable } from "./handbook_editions";

export const admissionCutoffsTable = pgTable(
  "admission_cutoffs",
  {
    id: serial("id").primaryKey(),
    programmeId: integer("programme_id").notNull().references(() => degreeProgrammesTable.id, { onDelete: "restrict" }),
    editionId: integer("edition_id").notNull().references(() => handbookEditionsTable.id, { onDelete: "restrict" }),
    district: text("district").notNull(),
    minimumZScore: real("minimum_z_score").notNull(),
    sourcePage: integer("source_page"),
    // "legacy_verified": imported via the original direct-import pipeline, trusted by default.
    // "verified": promoted from the extraction review workflow.
    // "rejected": kept for audit trail, excluded from public checker results.
    verifiedStatus: text("verified_status").notNull().default("legacy_verified"),
  },
  (table) => [
    unique("admission_cutoffs_programme_id_edition_id_district_unique").on(
      table.programmeId,
      table.editionId,
      table.district,
    ),
    index("admission_cutoffs_programme_id_idx").on(table.programmeId),
    index("admission_cutoffs_edition_id_idx").on(table.editionId),
    index("admission_cutoffs_district_idx").on(table.district),
    index("admission_cutoffs_verified_status_idx").on(table.verifiedStatus),
    index("admission_cutoffs_programme_district_verified_idx").on(
      table.programmeId,
      table.district,
      table.verifiedStatus,
    ),
  ],
);
