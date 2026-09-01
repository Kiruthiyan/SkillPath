import { db } from "./client";
import {
  degreeProgrammesTable,
  admissionCutoffsTable,
  handbookEditionsTable,
  universitiesTable,
  coursesTable,
} from "./schema/index";
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import {
  predictCutoff,
  eligibilityTier,
  effectiveCutoff,
  nextAcademicYear,
  type YearMode,
  type CutoffHistoryPoint,
  type CutoffPrediction,
} from "./predict";
import { VERIFIED_CUTOFF_STATUSES } from "./verified-cutoffs";

export interface ProgrammeWithCutoff {
  id: number;
  universityId: number;
  universityName: string | null;
  universityShortName: string | null;
  degreeName: string;
  faculty: string;
  degreeType: string;
  durationYears: number;
  stream: string;
  description: string | null;
  minimumZScore: number;
  officialMinimumZScore: number | null;
  predictedMinimumZScore: number | null;
  officialAcademicYear: string | null;
  predictedAcademicYear: string | null;
  confidence: string;
  eligibility: string | null;
  dataSource: string;
  matchScore: string | null;
  district: string;
}

export async function getLatestEdition() {
  const [edition] = await db
    .select()
    .from(handbookEditionsTable)
    .orderBy(desc(handbookEditionsTable.academicYear))
    .limit(1);
  return edition ?? null;
}

export async function getEditionByYear(academicYear: string) {
  const [edition] = await db
    .select()
    .from(handbookEditionsTable)
    .where(eq(handbookEditionsTable.academicYear, academicYear))
    .limit(1);
  return edition ?? null;
}

async function getCutoffHistory(
  programmeId: number,
  district: string,
): Promise<CutoffHistoryPoint[]> {
  const rows = await db
    .select({
      academicYear: handbookEditionsTable.academicYear,
      minimumZScore: admissionCutoffsTable.minimumZScore,
    })
    .from(admissionCutoffsTable)
    .innerJoin(
      handbookEditionsTable,
      eq(admissionCutoffsTable.editionId, handbookEditionsTable.id),
    )
    .where(
      and(
        eq(admissionCutoffsTable.programmeId, programmeId),
        eq(admissionCutoffsTable.district, district),
        inArray(admissionCutoffsTable.verifiedStatus, [...VERIFIED_CUTOFF_STATUSES]),
      ),
    )
    .orderBy(asc(handbookEditionsTable.academicYear));

  return rows;
}

function resolveDistrictCutoff(
  district: string,
  cutoffsByDistrict: Map<string, number>,
): number | null {
  if (cutoffsByDistrict.has(district)) {
    return cutoffsByDistrict.get(district)!;
  }
  if (cutoffsByDistrict.has("All Island")) {
    return cutoffsByDistrict.get("All Island")!;
  }
  return null;
}

function matchScore(zscore: number, minimumZScore: number): string {
  const diff = zscore - minimumZScore;
  if (diff >= 0.3) return "High";
  if (diff >= 0.05) return "Medium";
  return "Low";
}

export async function listProgrammesWithCutoffs(opts: {
  stream?: string;
  zscore?: number;
  universityId?: number;
  degreeType?: string;
  duration?: number;
  faculty?: string;
  district?: string;
  yearMode?: YearMode;
  academicYear?: string;
}): Promise<ProgrammeWithCutoff[]> {
  const {
    stream,
    zscore,
    universityId,
    degreeType,
    duration,
    faculty,
    district = "All Island",
    yearMode = "predicted",
    academicYear,
  } = opts;

  const edition = academicYear
    ? await getEditionByYear(academicYear)
    : await getLatestEdition();

  if (!edition) return [];

  const programmeConditions = [];
  if (stream) programmeConditions.push(sql`lower(${degreeProgrammesTable.stream}) = lower(${stream})`);
  if (universityId)
    programmeConditions.push(eq(degreeProgrammesTable.universityId, universityId));
  if (degreeType)
    programmeConditions.push(eq(degreeProgrammesTable.degreeType, degreeType));
  if (duration)
    programmeConditions.push(eq(degreeProgrammesTable.durationYears, duration));
  if (faculty) programmeConditions.push(eq(degreeProgrammesTable.faculty, faculty));

  let programmeQuery = db
    .select({
      id: degreeProgrammesTable.id,
      universityId: degreeProgrammesTable.universityId,
      universityName: universitiesTable.name,
      universityShortName: universitiesTable.shortName,
      degreeName: degreeProgrammesTable.degreeName,
      faculty: degreeProgrammesTable.faculty,
      degreeType: degreeProgrammesTable.degreeType,
      durationYears: degreeProgrammesTable.durationYears,
      stream: degreeProgrammesTable.stream,
      description: degreeProgrammesTable.description,
    })
    .from(degreeProgrammesTable)
    .leftJoin(
      universitiesTable,
      eq(degreeProgrammesTable.universityId, universitiesTable.id),
    )
    .orderBy(asc(degreeProgrammesTable.degreeName))
    .$dynamic();

  if (programmeConditions.length > 0) {
    programmeQuery = programmeQuery.where(and(...programmeConditions));
  }

  const programmes = await programmeQuery;
  const programmeIds = programmes.map((p) => p.id);

  if (programmeIds.length === 0) return [];

  const allCutoffs = await db
    .select({
      programmeId: admissionCutoffsTable.programmeId,
      district: admissionCutoffsTable.district,
      minimumZScore: admissionCutoffsTable.minimumZScore,
      academicYear: handbookEditionsTable.academicYear,
    })
    .from(admissionCutoffsTable)
    .innerJoin(
      handbookEditionsTable,
      eq(admissionCutoffsTable.editionId, handbookEditionsTable.id),
    )
    .where(
      and(
        inArray(admissionCutoffsTable.programmeId, programmeIds),
        inArray(admissionCutoffsTable.verifiedStatus, [...VERIFIED_CUTOFF_STATUSES]),
      ),
    );

  const cutoffsByProgramme = new Map<
    number,
    Map<string, CutoffHistoryPoint[]>
  >();

  for (const row of allCutoffs) {
    if (!cutoffsByProgramme.has(row.programmeId)) {
      cutoffsByProgramme.set(row.programmeId, new Map());
    }
    const byDistrict = cutoffsByProgramme.get(row.programmeId)!;
    if (!byDistrict.has(row.district)) {
      byDistrict.set(row.district, []);
    }
    byDistrict.get(row.district)!.push({
      academicYear: row.academicYear,
      minimumZScore: row.minimumZScore,
    });
  }

  const targetYear = nextAcademicYear(edition.academicYear);
  const results: ProgrammeWithCutoff[] = [];

  for (const programme of programmes) {
    const byDistrict = cutoffsByProgramme.get(programme.id);
    if (!byDistrict) continue;

    const history =
      byDistrict.get(district) ??
      byDistrict.get("All Island") ??
      [];
    if (history.length === 0) continue;

    const prediction = predictCutoff(history, targetYear);
    const cutoff = effectiveCutoff(prediction, yearMode);
    if (cutoff == null) continue;

    const eligibility =
      zscore != null && !Number.isNaN(zscore)
        ? eligibilityTier(zscore, cutoff)
        : null;

    if (zscore != null && !Number.isNaN(zscore) && zscore < cutoff - 0.15) {
      continue;
    }

    results.push({
      ...programme,
      minimumZScore: cutoff,
      officialMinimumZScore: prediction.officialCutoff,
      predictedMinimumZScore: prediction.predictedCutoff,
      officialAcademicYear: prediction.officialAcademicYear,
      predictedAcademicYear: prediction.predictedAcademicYear,
      confidence: prediction.confidence,
      eligibility,
      dataSource: yearMode === "official" ? "official" : prediction.dataSource,
      matchScore:
        zscore != null && !Number.isNaN(zscore)
          ? matchScore(zscore, cutoff)
          : null,
      district,
    });
  }

  return results;
}

export async function getProgrammeDetail(
  programmeId: number,
  district = "All Island",
  yearMode: YearMode = "predicted",
) {
  const [programme] = await db
    .select({
      id: degreeProgrammesTable.id,
      universityId: degreeProgrammesTable.universityId,
      universityName: universitiesTable.name,
      universityShortName: universitiesTable.shortName,
      degreeName: degreeProgrammesTable.degreeName,
      faculty: degreeProgrammesTable.faculty,
      degreeType: degreeProgrammesTable.degreeType,
      durationYears: degreeProgrammesTable.durationYears,
      stream: degreeProgrammesTable.stream,
      description: degreeProgrammesTable.description,
    })
    .from(degreeProgrammesTable)
    .leftJoin(
      universitiesTable,
      eq(degreeProgrammesTable.universityId, universitiesTable.id),
    )
    .where(eq(degreeProgrammesTable.id, programmeId));

  if (!programme) return null;

  const [course] = await db
    .select({
      subjects: coursesTable.subjects,
      skillsDeveloped: coursesTable.skillsDeveloped,
    })
    .from(coursesTable)
    .where(eq(coursesTable.programmeId, programmeId))
    .limit(1);

  const history = await getCutoffHistory(programmeId, district);
  const fallbackHistory =
    history.length > 0
      ? history
      : await getCutoffHistory(programmeId, "All Island");

  const edition = await getLatestEdition();
  const targetYear = edition
    ? nextAcademicYear(edition.academicYear)
    : undefined;
  const prediction = predictCutoff(fallbackHistory, targetYear);
  const cutoff = effectiveCutoff(prediction, yearMode);

  return {
    ...programme,
    minimumZScore: cutoff ?? 0,
    officialMinimumZScore: prediction.officialCutoff,
    predictedMinimumZScore: prediction.predictedCutoff,
    officialAcademicYear: prediction.officialAcademicYear,
    predictedAcademicYear: prediction.predictedAcademicYear,
    confidence: prediction.confidence,
    dataSource: yearMode === "official" ? "official" : prediction.dataSource,
    district,
    subjects: course?.subjects ? JSON.parse(course.subjects) : [],
    skillsDeveloped: course?.skillsDeveloped
      ? JSON.parse(course.skillsDeveloped)
      : [],
    cutoffHistory: fallbackHistory,
    prediction,
  };
}

export async function getPredictionInsight(
  programmeId: number,
  district: string,
  studentZscore?: number,
) {
  const detail = await getProgrammeDetail(programmeId, district, "predicted");
  if (!detail) return null;

  const historyByDistrict: Record<string, CutoffHistoryPoint[]> = {};
  const districts = [district, "All Island"];
  for (const d of districts) {
    historyByDistrict[d] = await getCutoffHistory(programmeId, d);
  }

  const eligibility =
    studentZscore != null && detail.prediction.predictedCutoff != null
      ? eligibilityTier(studentZscore, detail.prediction.predictedCutoff)
      : null;

  return {
    programme: {
      id: detail.id,
      degreeName: detail.degreeName,
      universityName: detail.universityName,
      stream: detail.stream,
      faculty: detail.faculty,
    },
    district,
    studentZscore: studentZscore ?? null,
    history: detail.cutoffHistory,
    historyByDistrict,
    prediction: detail.prediction,
    eligibility,
    handbookAttribution: detail.officialAcademicYear
      ? `UGC University Admissions Handbook ${detail.officialAcademicYear}`
      : "UGC University Admissions Handbook",
  };
}

export type { CutoffPrediction };
