import { index, pgTable, serial, integer, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const extractionBatchesTable = pgTable(
  "extraction_batches",
  {
    id: serial("id").primaryKey(),
    academicYear: text("academic_year").notNull(),
    language: text("language").notNull(),
    sourceFileName: text("source_file_name").notNull(),
    // "pending_review" | "approved" | "rejected" | "partially_approved"
    status: text("status").notNull().default("pending_review"),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    notes: text("notes"),
  },
  (table) => [
    index("extraction_batches_status_idx").on(table.status),
    index("extraction_batches_academic_year_idx").on(table.academicYear),
  ],
);

export const extractedProgrammeRowsTable = pgTable(
  "extracted_programme_rows",
  {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => extractionBatchesTable.id, { onDelete: "restrict" }),
  // Each row's own academic year, which can differ from the batch's: a
  // single handbook PDF's Section 9 cutoffs cover the *previous* academic
  // year relative to the handbook's own edition (Section 2's) year.
  academicYear: text("academic_year"),
  rawUniversityName: text("raw_university_name").notNull(),
  rawDegreeName: text("raw_degree_name").notNull(),
  faculty: text("faculty"),
  stream: text("stream"),
  district: text("district"),
  minimumZScore: real("minimum_z_score"),
  // Non-numeric cutoff marker preserved verbatim, e.g. "NQC" (No Qualified
  // Candidates) — set instead of, never alongside, minimumZScore.
  zscoreMarker: text("zscore_marker"),
  durationYears: integer("duration_years"),
  degreeType: text("degree_type"),
  description: text("description"),
  subjectsRaw: jsonb("subjects_raw"),
  rulesRaw: jsonb("rules_raw"),
  sourcePage: integer("source_page"),
  // "2" (course/programme catalog) or "9" (previous-year district cutoffs) —
  // which handbook section this row was extracted from.
  sourceSection: text("source_section"),
  uniCode: text("uni_code"),
  matchedCanonicalKey: text("matched_canonical_key"),
  // "pending" | "approved" | "rejected" | "edited"
  status: text("status").notNull().default("pending"),
  // "clean" | "needs_review" | "verified" | "rejected"
  verificationStatus: text("verification_status").notNull().default("needs_review"),
  reviewNotes: text("review_notes"),
  correctedUniversityName: text("corrected_university_name"),
  correctedDegreeName: text("corrected_degree_name"),
  correctedFaculty: text("corrected_faculty"),
  correctedStream: text("corrected_stream"),
  correctedDistrict: text("corrected_district"),
  correctedMinimumZScore: real("corrected_minimum_z_score"),
  },
  (table) => [
    index("extracted_programme_rows_batch_id_idx").on(table.batchId),
    index("extracted_programme_rows_status_idx").on(table.status),
    index("extracted_programme_rows_verification_status_idx").on(table.verificationStatus),
    index("extracted_programme_rows_batch_status_verification_idx").on(
      table.batchId,
      table.status,
      table.verificationStatus,
    ),
  ],
);
