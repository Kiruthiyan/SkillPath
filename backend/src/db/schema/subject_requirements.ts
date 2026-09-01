import { index, pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { academicYearsTable } from "./academic_years";
import { degreeProgrammesTable } from "./degree_programmes";
import { handbookEditionsTable } from "./handbook_editions";
import { handbookSourcesTable } from "./handbook_sources";

export const subjectRequirementsTable = pgTable(
  "subject_requirements",
  {
    id: serial("id").primaryKey(),
    programmeId: integer("programme_id").notNull().references(() => degreeProgrammesTable.id, { onDelete: "restrict" }),
    academicYear: text("academic_year").references(() => academicYearsTable.academicYear, { onDelete: "restrict" }),
    // "compulsory": every row in this requirement must be satisfied.
    // "one_of": at least one row sharing the same groupKey must be satisfied.
    // "recommended": informational only, never fails eligibility.
    requirementType: text("requirement_type").notNull(),
    groupKey: text("group_key").notNull().default("default"),
    subjectName: text("subject_name").notNull(),
    minimumGrade: text("minimum_grade"),
    sourceEditionId: integer("source_edition_id").references(() => handbookEditionsTable.id, { onDelete: "set null" }),
    sourceHandbookId: integer("source_handbook_id").references(() => handbookSourcesTable.id, { onDelete: "set null" }),
    sourcePage: integer("source_page"),
  },
  (table) => [
    index("subject_requirements_programme_id_idx").on(table.programmeId),
    index("subject_requirements_programme_year_idx").on(table.programmeId, table.academicYear),
    index("subject_requirements_academic_year_idx").on(table.academicYear),
  ],
);
