import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import {
  academicYearsTable,
  admissionCutoffsTable,
  courseAvailabilityTable,
  degreeProgrammesTable,
  handbookEditionsTable,
  handbookSourcesTable,
} from "./schema/index";
import { VERIFIED_CUTOFF_STATUSES } from "./verified-cutoffs";
import { buildCourseAvailabilityStatuses } from "./year-modeling-rules";

function fallbackSourceFileName(academicYear: string, language: string) {
  return `handbook_${academicYear.replace("/", "_")}_${language}`;
}

function fileNameFromSourceUrl(sourceUrl: string | null, academicYear: string, language: string) {
  if (!sourceUrl) return fallbackSourceFileName(academicYear, language);
  const trimmed = sourceUrl.replace(/\/+$/, "");
  const fileName = trimmed.split("/").pop();
  return fileName && fileName.includes(".")
    ? fileName
    : fallbackSourceFileName(academicYear, language);
}

export async function getOrCreateHandbookSourceForEdition(input: {
  editionId: number;
  academicYear: string;
  language?: string | null;
  sourceUrl?: string | null;
  fileName?: string | null;
}) {
  const language = input.language ?? "en";
  const fileName = input.fileName ?? fileNameFromSourceUrl(input.sourceUrl ?? null, input.academicYear, language);

  const [existing] = await db
    .select({ id: handbookSourcesTable.id })
    .from(handbookSourcesTable)
    .where(
      and(
        eq(handbookSourcesTable.editionId, input.editionId),
        eq(handbookSourcesTable.language, language),
        eq(handbookSourcesTable.fileName, fileName),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  const [inserted] = await db
    .insert(handbookSourcesTable)
    .values({
      editionId: input.editionId,
      language,
      fileName,
      sourceUrl: input.sourceUrl ?? null,
    })
    .returning({ id: handbookSourcesTable.id });

  return inserted.id;
}

export async function upsertAcademicYearRecord(
  academicYear: string,
  sourceHandbookId: number | null,
  handbookAvailable = true,
) {
  await db
    .insert(academicYearsTable)
    .values({
      academicYear,
      handbookAvailable,
      sourceHandbookId,
    })
    .onConflictDoUpdate({
      target: academicYearsTable.academicYear,
      set: {
        handbookAvailable,
        sourceHandbookId,
      },
    });
}

export async function markCourseAvailable(
  programmeId: number,
  academicYear: string,
  sourceHandbookId: number | null,
  sourcePage: number | null = null,
) {
  await db
    .insert(courseAvailabilityTable)
    .values({
      degreeProgrammeId: programmeId,
      academicYear,
      available: true,
      sourceHandbookId,
      sourcePage,
    })
    .onConflictDoUpdate({
      target: [courseAvailabilityTable.degreeProgrammeId, courseAvailabilityTable.academicYear],
      set: {
        available: true,
        sourceHandbookId,
        sourcePage,
      },
    });
}

export async function finalizeCourseAvailabilityForYear(input: {
  academicYear: string;
  availableProgrammeIds: Iterable<number>;
  sourceHandbookId: number | null;
  sourcePageByProgrammeId?: Map<number, number | null>;
}) {
  const programmes = await db
    .select({ id: degreeProgrammesTable.id })
    .from(degreeProgrammesTable)
    .orderBy(asc(degreeProgrammesTable.id));

  const statuses = buildCourseAvailabilityStatuses(
    programmes.map((programme) => programme.id),
    input.availableProgrammeIds,
  );

  for (const status of statuses) {
    const sourcePage = input.sourcePageByProgrammeId?.get(status.programmeId);
    const trueSet =
      sourcePage !== undefined
        ? {
            available: true,
            sourceHandbookId: input.sourceHandbookId,
            sourcePage,
          }
        : {
            available: true,
            sourceHandbookId: input.sourceHandbookId,
          };

    await db
      .insert(courseAvailabilityTable)
      .values({
        degreeProgrammeId: status.programmeId,
        academicYear: input.academicYear,
        available: status.available,
        sourceHandbookId: input.sourceHandbookId,
        sourcePage: sourcePage ?? null,
      })
      .onConflictDoUpdate({
        target: [courseAvailabilityTable.degreeProgrammeId, courseAvailabilityTable.academicYear],
        set: status.available
          ? trueSet
          : {
              available: false,
              sourceHandbookId: input.sourceHandbookId,
              sourcePage: null,
            },
      });
  }

  return statuses;
}

export async function syncYearModelFromVerifiedCutoffs() {
  const editions = await db
    .select({
      id: handbookEditionsTable.id,
      academicYear: handbookEditionsTable.academicYear,
      language: handbookEditionsTable.language,
      sourceUrl: handbookEditionsTable.sourceUrl,
    })
    .from(handbookEditionsTable)
    .orderBy(asc(handbookEditionsTable.academicYear));

  const results: Array<{
    academicYear: string;
    sourceHandbookId: number | null;
    availableCount: number;
    unavailableCount: number;
  }> = [];

  for (const edition of editions) {
    const sourceHandbookId = await getOrCreateHandbookSourceForEdition({
      editionId: edition.id,
      academicYear: edition.academicYear,
      language: edition.language,
      sourceUrl: edition.sourceUrl,
    });

    await upsertAcademicYearRecord(edition.academicYear, sourceHandbookId, true);

    const cutoffRows = await db
      .select({ programmeId: admissionCutoffsTable.programmeId })
      .from(admissionCutoffsTable)
      .where(
        and(
          eq(admissionCutoffsTable.editionId, edition.id),
          inArray(admissionCutoffsTable.verifiedStatus, [...VERIFIED_CUTOFF_STATUSES]),
        ),
      );

    const availableProgrammeIds = new Set<number>();
    for (const row of cutoffRows) {
      availableProgrammeIds.add(row.programmeId);
    }

    const statuses = await finalizeCourseAvailabilityForYear({
      academicYear: edition.academicYear,
      availableProgrammeIds,
      sourceHandbookId,
    });

    results.push({
      academicYear: edition.academicYear,
      sourceHandbookId,
      availableCount: statuses.filter((status) => status.available).length,
      unavailableCount: statuses.filter((status) => !status.available).length,
    });
  }

  return results;
}
