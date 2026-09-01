import { index, integer, pgTable, real, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { degreeProgrammesTable } from "./degree_programmes";

export const cutoffEstimatesTable = pgTable(
  "cutoff_estimates",
  {
    id: serial("id").primaryKey(),
    degreeProgrammeId: integer("degree_programme_id").notNull().references(() => degreeProgrammesTable.id, { onDelete: "restrict" }),
    district: text("district").notNull(),
    targetYear: text("target_year").notNull(),
    estimatedMin: real("estimated_min").notNull(),
    estimatedMax: real("estimated_max").notNull(),
    estimatedCenter: real("estimated_center").notNull(),
    confidence: text("confidence").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("cutoff_estimates_degree_programme_id_district_target_year_algor").on(
      table.degreeProgrammeId,
      table.district,
      table.targetYear,
      table.algorithmVersion,
    ),
    index("cutoff_estimates_programme_district_target_idx").on(
      table.degreeProgrammeId,
      table.district,
      table.targetYear,
    ),
  ],
);
