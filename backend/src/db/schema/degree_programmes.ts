import { index, pgTable, serial, text, integer, jsonb } from "drizzle-orm/pg-core";
import { universitiesTable } from "./universities";

export interface DegreeProgrammeTranslation {
  degreeName?: string;
  faculty?: string;
  description?: string;
}

export type DegreeProgrammeTranslations = Partial<
  Record<"en" | "si" | "ta", DegreeProgrammeTranslation>
>;

export const degreeProgrammesTable = pgTable(
  "degree_programmes",
  {
    id: serial("id").primaryKey(),
    universityId: integer("university_id").notNull().references(() => universitiesTable.id, { onDelete: "restrict" }),
    degreeName: text("degree_name").notNull(),
    faculty: text("faculty").notNull(),
    degreeType: text("degree_type").notNull(),
    durationYears: integer("duration_years").notNull(),
    stream: text("stream").notNull(),
    description: text("description"),
    translations: jsonb("translations").$type<DegreeProgrammeTranslations>(),
  },
  (table) => [
    index("degree_programmes_university_id_idx").on(table.universityId),
    index("degree_programmes_stream_idx").on(table.stream),
  ],
);
