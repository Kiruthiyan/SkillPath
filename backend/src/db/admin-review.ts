import { eq, and, inArray } from "drizzle-orm";
import { db } from "./client";
import {
  universitiesTable,
  degreeProgrammesTable,
  admissionCutoffsTable,
  handbookEditionsTable,
  extractionBatchesTable,
  extractedProgrammeRowsTable,
  type UniversityTranslations,
  type DegreeProgrammeTranslations,
} from "./schema/index";
import { inferDegreeType } from "./degree-type";
import { isBulkApprovableExtractedRow } from "./admin-review-rules";
import {
  finalizeCourseAvailabilityForYear,
  getOrCreateHandbookSourceForEdition,
  markCourseAvailable,
  upsertAcademicYearRecord,
} from "./year-modeling";

export type ExtractedProgrammeRow = typeof extractedProgrammeRowsTable.$inferSelect;
export { isBulkApprovableExtractedRow };

export async function listExtractionBatches(status?: string) {
  if (status) {
    return db.select().from(extractionBatchesTable).where(eq(extractionBatchesTable.status, status));
  }
  return db.select().from(extractionBatchesTable);
}

export async function listExtractedRows(opts: { batchId?: number; status?: string }) {
  const conditions = [];
  if (opts.batchId != null) conditions.push(eq(extractedProgrammeRowsTable.batchId, opts.batchId));
  if (opts.status) conditions.push(eq(extractedProgrammeRowsTable.status, opts.status));

  if (conditions.length === 0) {
    return db.select().from(extractedProgrammeRowsTable);
  }
  return db
    .select()
    .from(extractedProgrammeRowsTable)
    .where(and(...conditions));
}

function resolvedValue(row: ExtractedProgrammeRow) {
  return {
    university: row.correctedUniversityName ?? row.rawUniversityName,
    degreeName: row.correctedDegreeName ?? row.rawDegreeName,
    faculty: row.correctedFaculty ?? row.faculty ?? "General",
    stream: row.correctedStream ?? row.stream ?? "Physical Science",
    district: row.correctedDistrict ?? row.district ?? "All Island",
    minimumZScore: row.correctedMinimumZScore ?? row.minimumZScore,
    durationYears: row.durationYears ?? 3,
  };
}

async function upsertUniversityWithTranslation(
  name: string,
  language: string | null,
) {
  const [existing] = await db
    .select()
    .from(universitiesTable)
    .where(eq(universitiesTable.name, name))
    .limit(1);

  if (existing) {
    if (language && language !== "en") {
      const translations: UniversityTranslations = { ...(existing.translations ?? {}) };
      translations[language as "si" | "ta"] = { name };
      await db
        .update(universitiesTable)
        .set({ translations })
        .where(eq(universitiesTable.id, existing.id));
    }
    return existing.id;
  }

  const [inserted] = await db
    .insert(universitiesTable)
    .values({
      name,
      shortName: name.split(" ").pop() ?? name,
      location: "Sri Lanka",
      foundedYear: 1970,
      logoColor: "#1e3a5f",
      ranking: 99,
      description: null,
    })
    .returning({ id: universitiesTable.id });

  return inserted.id;
}

async function upsertProgrammeWithTranslation(
  universityId: number,
  degreeName: string,
  faculty: string,
  stream: string,
  language: string | null,
  durationYears: number,
) {
  const [existing] = await db
    .select()
    .from(degreeProgrammesTable)
    .where(
      and(
        eq(degreeProgrammesTable.universityId, universityId),
        eq(degreeProgrammesTable.degreeName, degreeName),
        eq(degreeProgrammesTable.stream, stream),
      ),
    )
    .limit(1);

  if (existing) {
    if (language && language !== "en") {
      const translations: DegreeProgrammeTranslations = { ...(existing.translations ?? {}) };
      translations[language as "si" | "ta"] = { degreeName, faculty };
      await db
        .update(degreeProgrammesTable)
        .set({ translations })
        .where(eq(degreeProgrammesTable.id, existing.id));
    }
    return existing.id;
  }

  const [inserted] = await db
    .insert(degreeProgrammesTable)
    .values({
      universityId,
      degreeName,
      faculty,
      degreeType: inferDegreeType(degreeName),
      durationYears,
      stream,
      description: null,
    })
    .returning({ id: degreeProgrammesTable.id });

  return inserted.id;
}

export async function approveExtractedRow(
  rowId: number,
  adminUserId: number,
  corrections?: {
    university?: string;
    degreeName?: string;
    faculty?: string;
    stream?: string;
    district?: string;
    minimumZScore?: number;
  },
) {
  const [row] = await db
    .select()
    .from(extractedProgrammeRowsTable)
    .where(eq(extractedProgrammeRowsTable.id, rowId));

  if (!row) return null;

  if (row.status !== "pending") {
    return { error: "Only pending extracted rows can be approved." };
  }

  if (row.verificationStatus !== "clean" && !corrections) {
    return { error: "Rows marked for review require manual corrections before approval." };
  }

  if (corrections) {
    await db
      .update(extractedProgrammeRowsTable)
      .set({
        correctedUniversityName: corrections.university ?? row.correctedUniversityName,
        correctedDegreeName: corrections.degreeName ?? row.correctedDegreeName,
        correctedFaculty: corrections.faculty ?? row.correctedFaculty,
        correctedStream: corrections.stream ?? row.correctedStream,
        correctedDistrict: corrections.district ?? row.correctedDistrict,
        correctedMinimumZScore: corrections.minimumZScore ?? row.correctedMinimumZScore,
      })
      .where(eq(extractedProgrammeRowsTable.id, rowId));
  }

  const [refreshedRow] = await db
    .select()
    .from(extractedProgrammeRowsTable)
    .where(eq(extractedProgrammeRowsTable.id, rowId));
  const resolved = resolvedValue(refreshedRow!);

  // A row can legitimately have no Z-score: Section 2 catalog/programme
  // rows never carry one, and Section 9 rows marked with a non-numeric
  // marker (e.g. "NQC" — No Qualified Candidates) explicitly have none for
  // that year/district. Both still promote the university/programme; only
  // the cutoff insert below is conditional on a numeric value being present.
  const [batch] = await db
    .select()
    .from(extractionBatchesTable)
    .where(eq(extractionBatchesTable.id, row.batchId));

  const [edition] = await db
    .select()
    .from(handbookEditionsTable)
    .where(eq(handbookEditionsTable.academicYear, batch?.academicYear ?? ""));

  let editionId = edition?.id;
  if (!editionId && batch) {
    const [insertedEdition] = await db
      .insert(handbookEditionsTable)
      .values({ academicYear: batch.academicYear })
      .returning({ id: handbookEditionsTable.id });
    editionId = insertedEdition.id;
  }

  const sourceHandbookId =
    editionId != null && batch
      ? await getOrCreateHandbookSourceForEdition({
          editionId,
          academicYear: batch.academicYear,
          language: batch.language,
          fileName: batch.sourceFileName,
        })
      : null;

  if (editionId != null && batch) {
    await upsertAcademicYearRecord(batch.academicYear, sourceHandbookId, true);
  }

  const universityId = await upsertUniversityWithTranslation(resolved.university, batch?.language ?? null);
  const programmeId = await upsertProgrammeWithTranslation(
    universityId,
    resolved.degreeName,
    resolved.faculty,
    resolved.stream,
    batch?.language ?? null,
    resolved.durationYears,
  );

  if (resolved.minimumZScore != null && editionId != null) {
    const [existingCutoff] = await db
      .select()
      .from(admissionCutoffsTable)
      .where(
        and(
          eq(admissionCutoffsTable.programmeId, programmeId),
          eq(admissionCutoffsTable.editionId, editionId),
          eq(admissionCutoffsTable.district, resolved.district),
        ),
      );

    if (existingCutoff) {
      await db
        .update(admissionCutoffsTable)
        .set({
          minimumZScore: resolved.minimumZScore,
          sourcePage: row.sourcePage,
          verifiedStatus: "verified",
        })
        .where(eq(admissionCutoffsTable.id, existingCutoff.id));
    } else {
      await db.insert(admissionCutoffsTable).values({
        programmeId,
        editionId,
        district: resolved.district,
        minimumZScore: resolved.minimumZScore,
        sourcePage: row.sourcePage,
        verifiedStatus: "verified",
      });
    }
  }

  if (batch && row.sourceSection === "2") {
    await markCourseAvailable(programmeId, row.academicYear ?? batch.academicYear, sourceHandbookId, row.sourcePage);
  }

  await db
    .update(extractedProgrammeRowsTable)
    .set({ status: corrections ? "edited" : "approved", verificationStatus: "verified" })
    .where(eq(extractedProgrammeRowsTable.id, rowId));

  await db
    .update(extractionBatchesTable)
    .set({ reviewedAt: new Date(), reviewedByUserId: adminUserId })
    .where(eq(extractionBatchesTable.id, row.batchId));

  return { universityId, programmeId };
}

export async function rejectExtractedRow(rowId: number, adminUserId: number, notes?: string) {
  const [row] = await db
    .select()
    .from(extractedProgrammeRowsTable)
    .where(eq(extractedProgrammeRowsTable.id, rowId));
  if (!row) return null;

  await db
    .update(extractedProgrammeRowsTable)
    .set({ status: "rejected", verificationStatus: "rejected", reviewNotes: notes ?? null })
    .where(eq(extractedProgrammeRowsTable.id, rowId));

  await db
    .update(extractionBatchesTable)
    .set({ reviewedAt: new Date(), reviewedByUserId: adminUserId })
    .where(eq(extractionBatchesTable.id, row.batchId));

  return { rowId };
}

export async function bulkApproveBatch(batchId: number, adminUserId: number) {
  const [batch] = await db
    .select()
    .from(extractionBatchesTable)
    .where(eq(extractionBatchesTable.id, batchId));

  const pendingRows = await db
    .select({
      id: extractedProgrammeRowsTable.id,
      sourceSection: extractedProgrammeRowsTable.sourceSection,
      sourcePage: extractedProgrammeRowsTable.sourcePage,
    })
    .from(extractedProgrammeRowsTable)
    .where(
      and(
        eq(extractedProgrammeRowsTable.batchId, batchId),
        inArray(extractedProgrammeRowsTable.status, ["pending"]),
        eq(extractedProgrammeRowsTable.verificationStatus, "clean"),
      ),
    );

  const results = [];
  const availableProgrammeIds = new Set<number>();
  const sourcePageByProgrammeId = new Map<number, number | null>();
  for (const row of pendingRows) {
    const result = await approveExtractedRow(row.id, adminUserId);
    results.push(result);
    if (row.sourceSection === "2" && result && !("error" in result)) {
      availableProgrammeIds.add(result.programmeId);
      sourcePageByProgrammeId.set(result.programmeId, row.sourcePage ?? null);
    }
  }

  if (batch && availableProgrammeIds.size > 0) {
    const [edition] = await db
      .select()
      .from(handbookEditionsTable)
      .where(eq(handbookEditionsTable.academicYear, batch.academicYear));
    const sourceHandbookId = edition
      ? await getOrCreateHandbookSourceForEdition({
          editionId: edition.id,
          academicYear: batch.academicYear,
          language: batch.language,
          fileName: batch.sourceFileName,
        })
      : null;

    await finalizeCourseAvailabilityForYear({
      academicYear: batch.academicYear,
      availableProgrammeIds,
      sourceHandbookId,
      sourcePageByProgrammeId,
    });
  }

  await db
    .update(extractionBatchesTable)
    .set({ status: "approved", reviewedAt: new Date(), reviewedByUserId: adminUserId })
    .where(eq(extractionBatchesTable.id, batchId));

  return { approvedCount: results.length };
}
