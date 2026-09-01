import "../load-env";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "./client";
import { inferDegreeType } from "./degree-type";
import {
  admissionCutoffsTable,
  admissionRulesTable,
  courseAvailabilityTable,
  degreeProgrammesTable,
  extractionBatchesTable,
  extractedProgrammeRowsTable,
  handbookEditionsTable,
  subjectRequirementsTable,
  universitiesTable,
  type DegreeProgrammeTranslations,
  type UniversityTranslations,
} from "./schema/index";
import {
  finalizeCourseAvailabilityForYear,
  getOrCreateHandbookSourceForEdition,
  upsertAcademicYearRecord,
} from "./year-modeling";

const TARGET_YEARS = ["2022/23", "2023/24", "2024/25", "2025/26"] as const;
const PROMOTABLE_CLEAN_STATUSES = ["clean"] as const;
const PROMOTABLE_APPROVED_STATUSES = ["approved", "edited"] as const;

type TargetYear = (typeof TARGET_YEARS)[number];
type ExtractedRow = typeof extractedProgrammeRowsTable.$inferSelect;

interface Counters {
  universitiesCreated: number;
  programmesCreated: number;
  programmesUpdated: number;
  availabilityUpserted: number;
  cutoffRecordsCreated: number;
  cutoffRecordsUpdated: number;
  rulesCreated: number;
  subjectRequirementsCreated: number;
  stagingRowsPromoted: number;
  skippedIncompleteSection2: number;
  skippedCutoffsMissingProgramme: number;
  skippedCutoffsAmbiguousProgramme: number;
  skippedCutoffsNonNumeric: number;
}

interface YearCounters extends Counters {
  sourceHandbookId: number | null;
}

interface PromotionContext {
  editionIdByYear: Map<string, number>;
  sourceHandbookIdByYear: Map<string, number>;
  programmeIdByKey: Map<string, number>;
  programmeIdsByUniversityDegree: Map<string, Set<number>>;
  availableProgrammeIdsByYear: Map<string, Set<number>>;
  sourcePageByYearProgramme: Map<string, Map<number, number | null>>;
  countersByYear: Map<string, YearCounters>;
  promotedRowIds: Set<number>;
}

function emptyCounters(sourceHandbookId: number | null): YearCounters {
  return {
    sourceHandbookId,
    universitiesCreated: 0,
    programmesCreated: 0,
    programmesUpdated: 0,
    availabilityUpserted: 0,
    cutoffRecordsCreated: 0,
    cutoffRecordsUpdated: 0,
    rulesCreated: 0,
    subjectRequirementsCreated: 0,
    stagingRowsPromoted: 0,
    skippedIncompleteSection2: 0,
    skippedCutoffsMissingProgramme: 0,
    skippedCutoffsAmbiguousProgramme: 0,
    skippedCutoffsNonNumeric: 0,
  };
}

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function programmeKey(universityId: number, degreeName: string, stream: string) {
  return `${universityId}:${normalized(degreeName)}:${normalized(stream)}`;
}

function universityDegreeKey(universityId: number, degreeName: string) {
  return `${universityId}:${normalized(degreeName)}`;
}

function cutoffKey(programmeId: number, editionId: number, district: string) {
  return `${programmeId}:${editionId}:${normalized(district)}`;
}

function resolvedUniversity(row: ExtractedRow) {
  return (row.correctedUniversityName ?? row.rawUniversityName ?? "").trim();
}

function resolvedDegree(row: ExtractedRow) {
  return (row.correctedDegreeName ?? row.rawDegreeName ?? "").trim();
}

function resolvedFaculty(row: ExtractedRow) {
  return (row.correctedFaculty ?? row.faculty ?? "General").trim() || "General";
}

function resolvedStream(row: ExtractedRow) {
  return (row.correctedStream ?? row.stream ?? "").trim();
}

function resolvedDistrict(row: ExtractedRow) {
  return (row.correctedDistrict ?? row.district ?? "").trim();
}

function resolvedMinimumZScore(row: ExtractedRow) {
  return row.correctedMinimumZScore ?? row.minimumZScore;
}

function isPromotable(row: ExtractedRow) {
  if (inArrayValue(row.verificationStatus, PROMOTABLE_CLEAN_STATUSES)) return true;
  return (
    inArrayValue(row.status, PROMOTABLE_APPROVED_STATUSES) &&
    row.verificationStatus === "verified"
  );
}

function inArrayValue<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  return typeof value === "string" && value.trim().length > 0 ? [value] : [];
}

async function getOrCreateEdition(academicYear: string) {
  const [existing] = await db
    .select({ id: handbookEditionsTable.id })
    .from(handbookEditionsTable)
    .where(eq(handbookEditionsTable.academicYear, academicYear))
    .limit(1);

  if (existing) return existing.id;

  const [inserted] = await db
    .insert(handbookEditionsTable)
    .values({ academicYear })
    .returning({ id: handbookEditionsTable.id });
  return inserted.id;
}

async function getOrCreateUniversity(name: string, language: string | null, counters: Counters) {
  const [existing] = await db
    .select()
    .from(universitiesTable)
    .where(eq(universitiesTable.name, name))
    .limit(1);

  if (existing) {
    if (language && language !== "en") {
      const translations: UniversityTranslations = { ...(existing.translations ?? {}) };
      translations[language as "si" | "ta"] = { name };
      await db.update(universitiesTable).set({ translations }).where(eq(universitiesTable.id, existing.id));
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

  counters.universitiesCreated++;
  return inserted.id;
}

async function upsertProgramme(
  row: ExtractedRow,
  universityId: number,
  language: string | null,
  counters: Counters,
) {
  const degreeName = resolvedDegree(row);
  const faculty = resolvedFaculty(row);
  const stream = resolvedStream(row);
  const durationYears = row.durationYears ?? 3;
  const degreeType = row.degreeType ?? inferDegreeType(degreeName);

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
    const translations: DegreeProgrammeTranslations = { ...(existing.translations ?? {}) };
    if (language && language !== "en") {
      translations[language as "si" | "ta"] = { degreeName, faculty };
    }

    await db
      .update(degreeProgrammesTable)
      .set({
        faculty,
        degreeType,
        durationYears,
        description: row.description ?? existing.description,
        translations: Object.keys(translations).length > 0 ? translations : existing.translations,
      })
      .where(eq(degreeProgrammesTable.id, existing.id));
    counters.programmesUpdated++;
    return existing.id;
  }

  const [inserted] = await db
    .insert(degreeProgrammesTable)
    .values({
      universityId,
      degreeName,
      faculty,
      degreeType,
      durationYears,
      stream,
      description: row.description ?? null,
    })
    .returning({ id: degreeProgrammesTable.id });

  counters.programmesCreated++;
  return inserted.id;
}

async function buildContext(): Promise<PromotionContext> {
  const countersByYear = new Map<string, YearCounters>();
  const editionIdByYear = new Map<string, number>();
  const sourceHandbookIdByYear = new Map<string, number>();
  const availableProgrammeIdsByYear = new Map<string, Set<number>>();
  const sourcePageByYearProgramme = new Map<string, Map<number, number | null>>();

  for (const year of TARGET_YEARS) {
    const editionId = await getOrCreateEdition(year);
    editionIdByYear.set(year, editionId);

    const [batch] = await db
      .select()
      .from(extractionBatchesTable)
      .where(eq(extractionBatchesTable.academicYear, year))
      .orderBy(asc(extractionBatchesTable.id))
      .limit(1);

    const sourceHandbookId = await getOrCreateHandbookSourceForEdition({
      editionId,
      academicYear: year,
      language: batch?.language ?? "en",
      fileName: batch?.sourceFileName ?? null,
    });

    sourceHandbookIdByYear.set(year, sourceHandbookId);
    countersByYear.set(year, emptyCounters(sourceHandbookId));
    availableProgrammeIdsByYear.set(year, new Set());
    sourcePageByYearProgramme.set(year, new Map());
    await upsertAcademicYearRecord(year, sourceHandbookId, true);
  }

  const programmeIdByKey = new Map<string, number>();
  const programmeIdsByUniversityDegree = new Map<string, Set<number>>();
  const programmes = await db
    .select({
      id: degreeProgrammesTable.id,
      universityId: degreeProgrammesTable.universityId,
      degreeName: degreeProgrammesTable.degreeName,
      stream: degreeProgrammesTable.stream,
    })
    .from(degreeProgrammesTable);

  for (const programme of programmes) {
    programmeIdByKey.set(
      programmeKey(programme.universityId, programme.degreeName, programme.stream),
      programme.id,
    );
    const key = universityDegreeKey(programme.universityId, programme.degreeName);
    if (!programmeIdsByUniversityDegree.has(key)) programmeIdsByUniversityDegree.set(key, new Set());
    programmeIdsByUniversityDegree.get(key)!.add(programme.id);
  }

  return {
    editionIdByYear,
    sourceHandbookIdByYear,
    programmeIdByKey,
    programmeIdsByUniversityDegree,
    availableProgrammeIdsByYear,
    sourcePageByYearProgramme,
    countersByYear,
    promotedRowIds: new Set(),
  };
}

async function getPromotableRows(sourceSection: string) {
  const rows = await db
    .select()
    .from(extractedProgrammeRowsTable)
    .where(
      and(
        inArray(extractedProgrammeRowsTable.academicYear, [...TARGET_YEARS]),
        eq(extractedProgrammeRowsTable.sourceSection, sourceSection),
      ),
    )
    .orderBy(asc(extractedProgrammeRowsTable.academicYear), asc(extractedProgrammeRowsTable.id));

  return rows.filter(isPromotable);
}

function getYearCounters(ctx: PromotionContext, year: string) {
  const counters = ctx.countersByYear.get(year);
  if (!counters) throw new Error(`Unexpected academic year during promotion: ${year}`);
  return counters;
}

async function promoteSection2(ctx: PromotionContext) {
  const rows = await getPromotableRows("2");

  for (const row of rows) {
    const year = row.academicYear as TargetYear;
    const counters = getYearCounters(ctx, year);
    const universityName = resolvedUniversity(row);
    const degreeName = resolvedDegree(row);
    const stream = resolvedStream(row);

    if (!universityName || !degreeName || !stream) {
      counters.skippedIncompleteSection2++;
      continue;
    }

    const [batch] = await db
      .select({ language: extractionBatchesTable.language })
      .from(extractionBatchesTable)
      .where(eq(extractionBatchesTable.id, row.batchId))
      .limit(1);

    const universityId = await getOrCreateUniversity(universityName, batch?.language ?? null, counters);
    const programmeId = await upsertProgramme(row, universityId, batch?.language ?? null, counters);
    const sourceHandbookId = ctx.sourceHandbookIdByYear.get(year) ?? null;

    await db
      .insert(courseAvailabilityTable)
      .values({
        degreeProgrammeId: programmeId,
        academicYear: year,
        available: true,
        sourceHandbookId,
        sourcePage: row.sourcePage,
      })
      .onConflictDoUpdate({
        target: [courseAvailabilityTable.degreeProgrammeId, courseAvailabilityTable.academicYear],
        set: {
          available: true,
          sourceHandbookId,
          sourcePage: row.sourcePage,
        },
      });

    counters.availabilityUpserted++;
    counters.stagingRowsPromoted++;
    ctx.promotedRowIds.add(row.id);
    ctx.availableProgrammeIdsByYear.get(year)?.add(programmeId);
    ctx.sourcePageByYearProgramme.get(year)?.set(programmeId, row.sourcePage);
    ctx.programmeIdByKey.set(programmeKey(universityId, degreeName, stream), programmeId);

    const universityDegree = universityDegreeKey(universityId, degreeName);
    if (!ctx.programmeIdsByUniversityDegree.has(universityDegree)) {
      ctx.programmeIdsByUniversityDegree.set(universityDegree, new Set());
    }
    ctx.programmeIdsByUniversityDegree.get(universityDegree)!.add(programmeId);

    await promoteRules(row, programmeId, year, ctx.editionIdByYear.get(year)!, sourceHandbookId, counters);
  }
}

async function promoteRules(
  row: ExtractedRow,
  programmeId: number,
  academicYear: string,
  sourceEditionId: number,
  sourceHandbookId: number | null,
  counters: Counters,
) {
  const texts = [...asStringArray(row.rulesRaw)];
  if (typeof row.subjectsRaw === "string" && row.subjectsRaw.trim().length > 0) {
    texts.push(row.subjectsRaw);
  }

  for (const description of texts) {
    const ruleType = description === row.subjectsRaw ? "subject_requirements_text" : "other";
    const [existing] = await db
      .select({ id: admissionRulesTable.id })
      .from(admissionRulesTable)
      .where(
        and(
          eq(admissionRulesTable.programmeId, programmeId),
          eq(admissionRulesTable.academicYear, academicYear),
          eq(admissionRulesTable.ruleType, ruleType),
          eq(admissionRulesTable.description, description),
        ),
      )
      .limit(1);

    if (existing) continue;

    await db.insert(admissionRulesTable).values({
      programmeId,
      academicYear,
      ruleType,
      description,
      blocksEligibility: true,
      sourceEditionId,
      sourceHandbookId,
      sourcePage: row.sourcePage,
    });
    counters.rulesCreated++;
  }
}

function resolveProgrammeForCutoff(row: ExtractedRow, universityId: number, ctx: PromotionContext) {
  const degreeName = resolvedDegree(row);
  const stream = resolvedStream(row);
  if (stream) {
    const programmeId = ctx.programmeIdByKey.get(programmeKey(universityId, degreeName, stream));
    if (programmeId) return { programmeId, ambiguous: false };
  }

  const ids = ctx.programmeIdsByUniversityDegree.get(universityDegreeKey(universityId, degreeName));
  if (!ids || ids.size === 0) return { programmeId: null, ambiguous: false };
  if (ids.size > 1) return { programmeId: null, ambiguous: true };
  return { programmeId: Array.from(ids)[0], ambiguous: false };
}

async function promoteSection9(ctx: PromotionContext) {
  const rows = await getPromotableRows("9");
  const universityIdByName = new Map<string, number>();
  const universities = await db
    .select({ id: universitiesTable.id, name: universitiesTable.name })
    .from(universitiesTable);
  for (const university of universities) {
    universityIdByName.set(normalized(university.name), university.id);
  }

  const existingCutoffs = await db
    .select({
      programmeId: admissionCutoffsTable.programmeId,
      editionId: admissionCutoffsTable.editionId,
      district: admissionCutoffsTable.district,
    })
    .from(admissionCutoffsTable)
    .where(inArray(admissionCutoffsTable.editionId, Array.from(ctx.editionIdByYear.values())));
  const existingCutoffKeys = new Set(
    existingCutoffs.map((row) => cutoffKey(row.programmeId, row.editionId, row.district)),
  );

  const cutoffValuesByKey = new Map<
    string,
    typeof admissionCutoffsTable.$inferInsert & { academicYear: string }
  >();

  for (const row of rows) {
    const year = row.academicYear as TargetYear;
    const counters = getYearCounters(ctx, year);
    const minimumZScore = resolvedMinimumZScore(row);
    const district = resolvedDistrict(row);
    if (minimumZScore == null || !district) {
      counters.skippedCutoffsNonNumeric++;
      continue;
    }

    const universityName = resolvedUniversity(row);
    const degreeName = resolvedDegree(row);
    if (!universityName || !degreeName) {
      counters.skippedCutoffsMissingProgramme++;
      continue;
    }

    const universityId = universityIdByName.get(normalized(universityName));
    if (!universityId) {
      counters.skippedCutoffsMissingProgramme++;
      continue;
    }

    const mapped = resolveProgrammeForCutoff(row, universityId, ctx);
    if (mapped.ambiguous) {
      counters.skippedCutoffsAmbiguousProgramme++;
      continue;
    }
    if (!mapped.programmeId) {
      counters.skippedCutoffsMissingProgramme++;
      continue;
    }

    const editionId = ctx.editionIdByYear.get(year)!;
    cutoffValuesByKey.set(cutoffKey(mapped.programmeId, editionId, district), {
      academicYear: year,
      programmeId: mapped.programmeId,
      editionId,
      district,
      minimumZScore,
      sourcePage: row.sourcePage,
      verifiedStatus: "verified",
    });
  }

  for (const cutoff of cutoffValuesByKey.values()) {
    const counters = getYearCounters(ctx, cutoff.academicYear);
    if (existingCutoffKeys.has(cutoffKey(cutoff.programmeId, cutoff.editionId, cutoff.district))) {
      counters.cutoffRecordsUpdated++;
    } else {
      counters.cutoffRecordsCreated++;
    }
    counters.stagingRowsPromoted++;
  }

  const values = Array.from(cutoffValuesByKey.values()).map(({ academicYear: _academicYear, ...value }) => value);
  for (let index = 0; index < values.length; index += 500) {
    const batch = values.slice(index, index + 500);
    if (batch.length === 0) continue;
    await db
      .insert(admissionCutoffsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          admissionCutoffsTable.programmeId,
          admissionCutoffsTable.editionId,
          admissionCutoffsTable.district,
        ],
        set: {
          minimumZScore: sql`excluded.minimum_z_score`,
          sourcePage: sql`excluded.source_page`,
          verifiedStatus: sql`excluded.verified_status`,
        },
      });
  }

  for (const row of rows) {
    const year = row.academicYear as TargetYear;
    const minimumZScore = resolvedMinimumZScore(row);
    const district = resolvedDistrict(row);
    if (minimumZScore == null || !district) continue;

    const universityId = universityIdByName.get(normalized(resolvedUniversity(row)));
    if (!universityId) continue;

    const mapped = resolveProgrammeForCutoff(row, universityId, ctx);
    if (mapped.programmeId && !mapped.ambiguous) {
      ctx.promotedRowIds.add(row.id);
    }
  }
}

async function finalizeAvailability(ctx: PromotionContext) {
  for (const year of TARGET_YEARS) {
    const counters = getYearCounters(ctx, year);
    const statuses = await finalizeCourseAvailabilityForYear({
      academicYear: year,
      availableProgrammeIds: ctx.availableProgrammeIdsByYear.get(year) ?? [],
      sourceHandbookId: ctx.sourceHandbookIdByYear.get(year) ?? null,
      sourcePageByProgrammeId: ctx.sourcePageByYearProgramme.get(year),
    });
    counters.availabilityUpserted += statuses.filter((status) => !status.available).length;
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function markPromotedRowsApproved(promotedRowIds: Set<number>) {
  await db
    .update(extractedProgrammeRowsTable)
    .set({ status: "pending" })
    .where(
      and(
        inArray(extractedProgrammeRowsTable.academicYear, [...TARGET_YEARS]),
        eq(extractedProgrammeRowsTable.verificationStatus, "clean"),
      ),
    );

  const ids = Array.from(promotedRowIds);
  for (const batch of chunks(ids, 500)) {
    if (batch.length === 0) continue;
    await db
      .update(extractedProgrammeRowsTable)
      .set({ status: "approved" })
      .where(inArray(extractedProgrammeRowsTable.id, batch));
  }

  await db
    .update(extractedProgrammeRowsTable)
    .set({ status: "approved" })
    .where(
      and(
        inArray(extractedProgrammeRowsTable.academicYear, [...TARGET_YEARS]),
        inArray(extractedProgrammeRowsTable.status, [...PROMOTABLE_APPROVED_STATUSES]),
        eq(extractedProgrammeRowsTable.verificationStatus, "verified"),
      ),
    );
}

async function main() {
  const ctx = await buildContext();
  await promoteSection2(ctx);
  await promoteSection9(ctx);
  await finalizeAvailability(ctx);
  await markPromotedRowsApproved(ctx.promotedRowIds);

  console.log(JSON.stringify(Object.fromEntries(ctx.countersByYear), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
