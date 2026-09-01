import { index, pgTable, serial, integer, text, boolean, jsonb } from "drizzle-orm/pg-core";
import { academicYearsTable } from "./academic_years";
import { degreeProgrammesTable } from "./degree_programmes";
import { handbookEditionsTable } from "./handbook_editions";
import { handbookSourcesTable } from "./handbook_sources";

export type AdmissionRuleTranslations = Partial<Record<"en" | "si" | "ta", string>>;

export const admissionRulesTable = pgTable(
  "admission_rules",
  {
    id: serial("id").primaryKey(),
    programmeId: integer("programme_id").notNull().references(() => degreeProgrammesTable.id, { onDelete: "restrict" }),
    academicYear: text("academic_year").references(() => academicYearsTable.academicYear, { onDelete: "restrict" }),
    ruleType: text("rule_type").notNull(),
    // "minimum_overall_grades" | "aptitude_test" | "interview" | "district_quota_note" | "other"
    description: text("description").notNull(),
    translations: jsonb("translations").$type<AdmissionRuleTranslations>(),
    blocksEligibility: boolean("blocks_eligibility").notNull().default(true),
    sourceEditionId: integer("source_edition_id").references(() => handbookEditionsTable.id, { onDelete: "set null" }),
    sourceHandbookId: integer("source_handbook_id").references(() => handbookSourcesTable.id, { onDelete: "set null" }),
    sourcePage: integer("source_page"),
  },
  (table) => [
    index("admission_rules_programme_id_idx").on(table.programmeId),
    index("admission_rules_programme_year_idx").on(table.programmeId, table.academicYear),
    index("admission_rules_academic_year_idx").on(table.academicYear),
  ],
);
