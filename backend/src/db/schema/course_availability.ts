import { boolean, index, integer, pgTable, serial, text, unique } from "drizzle-orm/pg-core";
import { degreeProgrammesTable } from "./degree_programmes";
import { handbookSourcesTable } from "./handbook_sources";

export const courseAvailabilityTable = pgTable(
  "course_availability",
  {
    id: serial("id").primaryKey(),
    degreeProgrammeId: integer("degree_programme_id").notNull().references(() => degreeProgrammesTable.id, { onDelete: "restrict" }),
    academicYear: text("academic_year").notNull(),
    available: boolean("available").notNull().default(true),
    intake: integer("intake"),
    medium: text("medium"),
    sourceHandbookId: integer("source_handbook_id").references(() => handbookSourcesTable.id, { onDelete: "set null" }),
    sourcePage: integer("source_page"),
  },
  (table) => [
    unique("course_availability_degree_programme_id_academic_year_unique").on(
      table.degreeProgrammeId,
      table.academicYear,
    ),
    index("course_availability_academic_year_idx").on(table.academicYear),
    index("course_availability_degree_programme_id_idx").on(table.degreeProgrammeId),
    index("course_availability_available_idx").on(table.available),
  ],
);
