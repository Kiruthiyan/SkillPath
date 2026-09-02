import { and, asc, eq, inArray, lt, or, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import {
  academicYearsTable,
  admissionCutoffsTable,
  admissionRulesTable,
  courseAvailabilityTable,
  cutoffEstimatesTable,
  degreeProgrammesTable,
  handbookEditionsTable,
  handbookSourcesTable,
  subjectRequirementsTable,
  universitiesTable,
} from "./schema/index";
import { computeZScoreEstimate, type HistoricalCutoffPoint, type ZScoreEstimate } from "./estimate";
import {
  evaluateRulesStep,
  evaluateStreamStep,
  evaluateSubjectsStep,
  type AdmissionRuleRow,
  type SubjectRequirementRow,
} from "./eligibility-rules";
import {
  historicalGroup,
  officialGroup,
  type CheckerResultGroup,
} from "./checker-recommendation-rules";
import { groupApplicableYearRows } from "./eligibility-year-scope";
import { VERIFIED_CUTOFF_STATUSES } from "./verified-cutoffs";

const ALGORITHM_VERSION = "weighted-recency-v1";

export type CheckerResultMode = "official" | "historical_estimate";
export interface CheckerRecommendationRequest {
  academicYear: string;
  district: string;
  stream: string;
  subjectGrades: Record<string, string>;
  zscore: number;
}

export interface CheckerRecommendation {
  programmeId: number;
  universityId: number;
  university: string;
  courseName: string;
  faculty: string;
  degreeDuration: number;
  medium: string | null;
  studentZScore: number;
  officialCutoff: number | null;
  estimatedMin: number | null;
  estimatedMax: number | null;
  estimatedCenter: number | null;
  confidence: "High" | "Medium" | "Low" | null;
  academicYear: string;
  sourceHandbook: string;
  sourcePage: number | null;
  requiredStream: string;
  requiredSubjects: { subjectName: string; requirementType: string; minimumGrade: string | null }[];
  reasons: string[];
}

export interface CheckerRecommendationsResponse {
  mode: CheckerResultMode;
  resultModeLabel: "Official Handbook Based Result" | "Historical Estimate";
  academicYear: string;
  district: string;
  disclaimer: string;
  message?: "Insufficient verified data" | "Insufficient historical data";
  groups: Record<CheckerResultGroup, CheckerRecommendation[]>;
  strongMatches: CheckerRecommendation[];
  competitiveOptions: CheckerRecommendation[];
  nearHistoricalRange: CheckerRecommendation[];
  notEligible: CheckerRecommendation[];
}

export interface CandidateProgramme {
  id: number;
  universityId: number;
  universityName: string | null;
  degreeName: string;
  faculty: string;
  durationYears: number;
  stream: string;
  medium: string | null;
  availabilitySourceHandbookId: number | null;
  availabilitySourcePage: number | null;
}

export interface CutoffWithSource extends HistoricalCutoffPoint {
  editionId: number;
  sourcePage: number | null;
}

export interface ProgrammeChecks {
  requirements: SubjectRequirementRow[];
  rules: AdmissionRuleRow[];
}

export interface OfficialCutoff {
  district: string;
  minimumZScore: number;
  sourcePage: number | null;
}

export interface CheckerRecommendationEngineContext {
  mode: CheckerResultMode;
  editionId: number | null;
  candidates: CandidateProgramme[];
  requirementsByProgramme: Map<number, ProgrammeChecks>;
  getOfficialCutoff: (programmeId: number, editionId: number, district: string) => Promise<OfficialCutoff | null>;
  getVerifiedHistoryBeforeYear: (programmeId: number, district: string, targetYear: string) => Promise<CutoffWithSource[]>;
  getHandbookLabel: (editionId: number | null, sourceHandbookId: number | null, academicYear: string) => Promise<string>;
  persistEstimate: (programmeId: number, district: string, targetYear: string, estimate: ZScoreEstimate) => Promise<void>;
}

function emptyGroups(): Record<CheckerResultGroup, CheckerRecommendation[]> {
  return {
    strongMatches: [],
    competitiveOptions: [],
    nearHistoricalRange: [],
    notEligible: [],
  };
}

function hasFailed(status: string) {
  return status === "fail";
}

async function hasCourseAvailabilityForYear(academicYear: string): Promise<boolean> {
  const rows = await db
    .select({ id: courseAvailabilityTable.id })
    .from(courseAvailabilityTable)
    .where(eq(courseAvailabilityTable.academicYear, academicYear))
    .limit(1);
  return rows.length > 0;
}

export async function getModeForYear(academicYear: string): Promise<{
  mode: CheckerResultMode;
  editionId: number | null;
}> {
  const [trackedYear] = await db
    .select()
    .from(academicYearsTable)
    .where(eq(academicYearsTable.academicYear, academicYear))
    .limit(1);

  const [edition] = await db
    .select({ id: handbookEditionsTable.id })
    .from(handbookEditionsTable)
    .where(eq(handbookEditionsTable.academicYear, academicYear))
    .limit(1);

  if (edition && trackedYear?.handbookAvailable === true) {
    return { mode: "official", editionId: edition.id };
  }

  return { mode: "historical_estimate", editionId: null };
}

function streamMatches(stream: string) {
  return sql`lower(${degreeProgrammesTable.stream}) = lower(${stream})`;
}

export async function listCandidateProgrammes(
  academicYear: string,
  mode: CheckerResultMode,
  stream: string,
): Promise<CandidateProgramme[]> {
  if (mode === "official") {
    return db
      .select({
        id: degreeProgrammesTable.id,
        universityId: degreeProgrammesTable.universityId,
        universityName: universitiesTable.name,
        degreeName: degreeProgrammesTable.degreeName,
        faculty: degreeProgrammesTable.faculty,
        durationYears: degreeProgrammesTable.durationYears,
        stream: degreeProgrammesTable.stream,
        medium: courseAvailabilityTable.medium,
        availabilitySourceHandbookId: courseAvailabilityTable.sourceHandbookId,
        availabilitySourcePage: courseAvailabilityTable.sourcePage,
      })
      .from(courseAvailabilityTable)
      .innerJoin(
        degreeProgrammesTable,
        eq(courseAvailabilityTable.degreeProgrammeId, degreeProgrammesTable.id),
      )
      .leftJoin(universitiesTable, eq(degreeProgrammesTable.universityId, universitiesTable.id))
      .where(
        and(
          eq(courseAvailabilityTable.academicYear, academicYear),
          eq(courseAvailabilityTable.available, true),
          streamMatches(stream),
        ),
      )
      .orderBy(asc(degreeProgrammesTable.degreeName));
  }

  const rows = await db
    .selectDistinct({
      id: degreeProgrammesTable.id,
      universityId: degreeProgrammesTable.universityId,
      universityName: universitiesTable.name,
      degreeName: degreeProgrammesTable.degreeName,
      faculty: degreeProgrammesTable.faculty,
      durationYears: degreeProgrammesTable.durationYears,
      stream: degreeProgrammesTable.stream,
      medium: degreeProgrammesTable.description,
      availabilitySourceHandbookId: degreeProgrammesTable.universityId,
      availabilitySourcePage: degreeProgrammesTable.universityId,
    })
    .from(admissionCutoffsTable)
    .innerJoin(handbookEditionsTable, eq(admissionCutoffsTable.editionId, handbookEditionsTable.id))
    .innerJoin(degreeProgrammesTable, eq(admissionCutoffsTable.programmeId, degreeProgrammesTable.id))
    .leftJoin(universitiesTable, eq(degreeProgrammesTable.universityId, universitiesTable.id))
    .where(
      and(
        lt(handbookEditionsTable.academicYear, academicYear),
        inArray(admissionCutoffsTable.verifiedStatus, [...VERIFIED_CUTOFF_STATUSES]),
        streamMatches(stream),
      ),
    )
    .orderBy(asc(degreeProgrammesTable.degreeName));

  return rows.map((row) => ({
    ...row,
    medium: null,
    availabilitySourceHandbookId: null,
    availabilitySourcePage: null,
  }));
}

async function getRequirementsByProgramme(programmeIds: number[], academicYear: string) {
  const [requirements, rules] = await Promise.all([
    db
      .select({
        programmeId: subjectRequirementsTable.programmeId,
        academicYear: subjectRequirementsTable.academicYear,
        requirementType: subjectRequirementsTable.requirementType,
        groupKey: subjectRequirementsTable.groupKey,
        subjectName: subjectRequirementsTable.subjectName,
        minimumGrade: subjectRequirementsTable.minimumGrade,
      })
      .from(subjectRequirementsTable)
      .where(
        and(
          inArray(subjectRequirementsTable.programmeId, programmeIds),
          or(
            eq(subjectRequirementsTable.academicYear, academicYear),
            isNull(subjectRequirementsTable.academicYear),
          ),
        ),
      ),
    db
      .select({
        programmeId: admissionRulesTable.programmeId,
        academicYear: admissionRulesTable.academicYear,
        ruleType: admissionRulesTable.ruleType,
        description: admissionRulesTable.description,
        blocksEligibility: admissionRulesTable.blocksEligibility,
      })
      .from(admissionRulesTable)
      .where(
        and(
          inArray(admissionRulesTable.programmeId, programmeIds),
          or(
            eq(admissionRulesTable.academicYear, academicYear),
            isNull(admissionRulesTable.academicYear),
          ),
        ),
      ),
  ]);

  const byProgramme = new Map<number, { requirements: SubjectRequirementRow[]; rules: AdmissionRuleRow[] }>();
  const requirementsByProgramme = groupApplicableYearRows(requirements, programmeIds, academicYear);
  const rulesByProgramme = groupApplicableYearRows(rules, programmeIds, academicYear);
  for (const id of programmeIds) byProgramme.set(id, { requirements: [], rules: [] });
  for (const id of programmeIds) {
    byProgramme.set(id, {
      requirements: requirementsByProgramme.get(id) ?? [],
      rules: rulesByProgramme.get(id) ?? [],
    });
  }
  return byProgramme;
}

export async function getOfficialCutoff(programmeId: number, editionId: number, district: string) {
  const rows = await db
    .select({
      district: admissionCutoffsTable.district,
      minimumZScore: admissionCutoffsTable.minimumZScore,
      sourcePage: admissionCutoffsTable.sourcePage,
    })
    .from(admissionCutoffsTable)
    .where(
      and(
        eq(admissionCutoffsTable.programmeId, programmeId),
        eq(admissionCutoffsTable.editionId, editionId),
        inArray(admissionCutoffsTable.district, district === "All Island" ? ["All Island"] : [district, "All Island"]),
        inArray(admissionCutoffsTable.verifiedStatus, [...VERIFIED_CUTOFF_STATUSES]),
      ),
    );

  return rows.find((row) => row.district === district) ?? rows.find((row) => row.district === "All Island") ?? null;
}

export async function getVerifiedHistoryBeforeYear(
  programmeId: number,
  district: string,
  targetYear: string,
): Promise<CutoffWithSource[]> {
  return db
    .select({
      academicYear: handbookEditionsTable.academicYear,
      minimumZScore: admissionCutoffsTable.minimumZScore,
      editionId: handbookEditionsTable.id,
      sourcePage: admissionCutoffsTable.sourcePage,
    })
    .from(admissionCutoffsTable)
    .innerJoin(handbookEditionsTable, eq(admissionCutoffsTable.editionId, handbookEditionsTable.id))
    .where(
      and(
        eq(admissionCutoffsTable.programmeId, programmeId),
        eq(admissionCutoffsTable.district, district),
        lt(handbookEditionsTable.academicYear, targetYear),
        inArray(admissionCutoffsTable.verifiedStatus, [...VERIFIED_CUTOFF_STATUSES]),
      ),
    )
    .orderBy(asc(handbookEditionsTable.academicYear));
}

async function getHandbookLabel(editionId: number | null, sourceHandbookId: number | null, academicYear: string) {
  if (sourceHandbookId != null) {
    const [source] = await db
      .select({ fileName: handbookSourcesTable.fileName })
      .from(handbookSourcesTable)
      .where(eq(handbookSourcesTable.id, sourceHandbookId))
      .limit(1);
    if (source) return source.fileName;
  }

  if (editionId != null) {
    const [source] = await db
      .select({ fileName: handbookSourcesTable.fileName })
      .from(handbookSourcesTable)
      .where(eq(handbookSourcesTable.editionId, editionId))
      .limit(1);
    if (source) return source.fileName;
  }

  return `UGC University Admissions Handbook ${academicYear}`;
}

async function persistEstimate(programmeId: number, district: string, targetYear: string, estimate: ZScoreEstimate) {
  if (!estimate.hasSufficientData || estimate.rangeLow == null || estimate.rangeHigh == null || estimate.weightedEstimate == null) {
    return;
  }

  await db
    .insert(cutoffEstimatesTable)
    .values({
      degreeProgrammeId: programmeId,
      district,
      targetYear,
      estimatedMin: estimate.rangeLow,
      estimatedMax: estimate.rangeHigh,
      estimatedCenter: estimate.weightedEstimate,
      confidence: estimate.confidence,
      algorithmVersion: ALGORITHM_VERSION,
    })
    .onConflictDoUpdate({
      target: [
        cutoffEstimatesTable.degreeProgrammeId,
        cutoffEstimatesTable.district,
        cutoffEstimatesTable.targetYear,
        cutoffEstimatesTable.algorithmVersion,
      ],
      set: {
        estimatedMin: estimate.rangeLow,
        estimatedMax: estimate.rangeHigh,
        estimatedCenter: estimate.weightedEstimate,
        confidence: estimate.confidence,
        createdAt: new Date(),
      },
    });
}

function baseRecommendation(
  programme: CandidateProgramme,
  input: CheckerRecommendationRequest,
  sourceHandbook: string,
  sourcePage: number | null,
  requirements: SubjectRequirementRow[],
): Omit<
  CheckerRecommendation,
  "officialCutoff" | "estimatedMin" | "estimatedMax" | "estimatedCenter" | "confidence" | "reasons"
> {
  return {
    programmeId: programme.id,
    universityId: programme.universityId,
    university: programme.universityName ?? "",
    courseName: programme.degreeName,
    faculty: programme.faculty,
    degreeDuration: programme.durationYears,
    medium: programme.medium,
    studentZScore: input.zscore,
    academicYear: input.academicYear,
    sourceHandbook,
    sourcePage,
    requiredStream: programme.stream,
    requiredSubjects: requirements.map((r) => ({
      subjectName: r.subjectName,
      requirementType: r.requirementType,
      minimumGrade: r.minimumGrade,
    })),
  };
}

function subjectStepOrInsufficient(requirements: SubjectRequirementRow[], subjectGrades: Record<string, string>) {
  if (requirements.length === 0) {
    return {
      step: "subjects" as const,
      status: "fail" as const,
      reason: "Insufficient verified data: no verified subject requirements found for this programme and academic year.",
    };
  }
  return evaluateSubjectsStep(requirements, subjectGrades);
}

function responseMessage(
  groups: Record<CheckerResultGroup, CheckerRecommendation[]>,
  mode: CheckerResultMode,
  candidatesLength: number,
): CheckerRecommendationsResponse["message"] {
  if (candidatesLength === 0) {
    return mode === "official" ? "Insufficient verified data" : "Insufficient historical data";
  }

  const positiveCount =
    groups.strongMatches.length + groups.competitiveOptions.length + groups.nearHistoricalRange.length;
  if (positiveCount > 0 || groups.notEligible.length === 0) return undefined;

  const allVerifiedInsufficient = groups.notEligible.every((result) =>
    result.reasons.some((reason) =>
      reason.includes("Insufficient verified data") || reason.includes("No verified official cutoff"),
    ),
  );
  if (allVerifiedInsufficient) return "Insufficient verified data";

  const allHistoricalInsufficient = groups.notEligible.every((result) =>
    result.reasons.some((reason) =>
      reason.includes("Insufficient historical data") || reason.includes("Not enough verified historical cutoff data"),
    ),
  );
  if (allHistoricalInsufficient) return "Insufficient historical data";

  return undefined;
}

function checkerResponse(input: CheckerRecommendationRequest, mode: CheckerResultMode, groups: Record<CheckerResultGroup, CheckerRecommendation[]>): CheckerRecommendationsResponse {
  const resultModeLabel =
    mode === "official" ? "Official Handbook Based Result" : "Historical Estimate";
  const disclaimer =
    mode === "official"
      ? "This result is based on verified official handbook data and is not a guarantee of admission."
      : "Based on previous verified admission data. Final selection depends on the official handbook and yearly competition.";

  return {
    mode,
    resultModeLabel,
    academicYear: input.academicYear,
    district: input.district,
    disclaimer,
    groups,
    strongMatches: groups.strongMatches,
    competitiveOptions: groups.competitiveOptions,
    nearHistoricalRange: groups.nearHistoricalRange,
    notEligible: groups.notEligible,
  };
}

export async function buildCheckerRecommendations(
  input: CheckerRecommendationRequest,
  context: CheckerRecommendationEngineContext,
): Promise<CheckerRecommendationsResponse> {
  const { mode, editionId, candidates } = context;
  const groups = emptyGroups();

  if (candidates.length === 0) {
    return {
      ...checkerResponse(input, mode, groups),
      message: mode === "official" ? "Insufficient verified data" : "Insufficient historical data",
    };
  }

  for (const programme of candidates) {
    const checks = context.requirementsByProgramme.get(programme.id) ?? { requirements: [], rules: [] };
    const streamStep = evaluateStreamStep(programme.stream, input.stream);
    const subjectsStep = hasFailed(streamStep.status)
      ? null
      : subjectStepOrInsufficient(checks.requirements, input.subjectGrades);
    const rulesStep = subjectsStep && !hasFailed(subjectsStep.status)
      ? evaluateRulesStep(checks.rules, input.subjectGrades)
      : null;
    const preliminaryReasons = [streamStep, subjectsStep, rulesStep]
      .filter((step): step is NonNullable<typeof step> => step != null)
      .map((step) => step.reason);

    const blocked = hasFailed(streamStep.status) || hasFailed(subjectsStep?.status ?? "") || hasFailed(rulesStep?.status ?? "");

    if (mode === "official" && editionId != null) {
      const cutoff = await context.getOfficialCutoff(programme.id, editionId, input.district);
      const sourceHandbook = await context.getHandbookLabel(
        editionId,
        programme.availabilitySourceHandbookId,
        input.academicYear,
      );

      if (blocked || !cutoff) {
        groups.notEligible.push({
          ...baseRecommendation(programme, input, sourceHandbook, cutoff?.sourcePage ?? programme.availabilitySourcePage, checks.requirements),
          officialCutoff: cutoff?.minimumZScore ?? null,
          estimatedMin: null,
          estimatedMax: null,
          estimatedCenter: null,
          confidence: null,
          reasons: cutoff
            ? preliminaryReasons
            : [...preliminaryReasons, `No verified official cutoff found for ${input.district} in ${input.academicYear}.`],
        });
        continue;
      }

      const group = officialGroup(input.zscore, cutoff.minimumZScore);
      const zscoreReason =
        group === "notEligible"
          ? `Your Z-score is below the official cutoff for this programme.`
          : `Your Z-score meets or is close to the official cutoff for this programme.`;

      groups[group].push({
        ...baseRecommendation(programme, input, sourceHandbook, cutoff.sourcePage ?? programme.availabilitySourcePage, checks.requirements),
        officialCutoff: cutoff.minimumZScore,
        estimatedMin: null,
        estimatedMax: null,
        estimatedCenter: null,
        confidence: null,
        reasons: [...preliminaryReasons, zscoreReason],
      });
      continue;
    }

    const history = await context.getVerifiedHistoryBeforeYear(programme.id, input.district, input.academicYear);
    const estimate = computeZScoreEstimate(history, input.zscore);
    if (estimate.hasSufficientData) {
      await context.persistEstimate(programme.id, input.district, input.academicYear, estimate);
    }

    const latestHistory = history[history.length - 1];
    const sourceHandbook = await context.getHandbookLabel(
      latestHistory?.editionId ?? null,
      null,
      latestHistory?.academicYear ?? input.academicYear,
    );

    if (blocked || !estimate.hasSufficientData) {
      groups.notEligible.push({
        ...baseRecommendation(programme, input, sourceHandbook, latestHistory?.sourcePage ?? null, checks.requirements),
        officialCutoff: null,
        estimatedMin: estimate.rangeLow,
        estimatedMax: estimate.rangeHigh,
        estimatedCenter: estimate.weightedEstimate,
        confidence: estimate.confidence,
        reasons: estimate.hasSufficientData
          ? preliminaryReasons
          : [...preliminaryReasons, `Insufficient historical data: not enough verified historical cutoff data for ${input.district}.`],
      });
      continue;
    }

    const group = historicalGroup(estimate.statusLabel);
    const zscoreReason =
      group === "notEligible"
        ? `Your Z-score is below the recent historical cutoff range.`
        : `Your Z-score is within or above the recent historical cutoff range.`;

    groups[group].push({
      ...baseRecommendation(programme, input, sourceHandbook, latestHistory?.sourcePage ?? null, checks.requirements),
      officialCutoff: null,
      estimatedMin: estimate.rangeLow,
      estimatedMax: estimate.rangeHigh,
      estimatedCenter: estimate.weightedEstimate,
      confidence: estimate.confidence,
      reasons: [...preliminaryReasons, zscoreReason],
    });
  }

  const sortByNearestZScore = (items: CheckerRecommendation[]) =>
    [...items].sort((a, b) => {
      const cutoffA = a.officialCutoff ?? a.estimatedCenter ?? (a.estimatedMin != null && a.estimatedMax != null ? (a.estimatedMin + a.estimatedMax) / 2 : null);
      const cutoffB = b.officialCutoff ?? b.estimatedCenter ?? (b.estimatedMin != null && b.estimatedMax != null ? (b.estimatedMin + b.estimatedMax) / 2 : null);
      if (cutoffA == null && cutoffB == null) return 0;
      if (cutoffA == null) return 1;
      if (cutoffB == null) return -1;
      const distA = Math.abs(input.zscore - cutoffA);
      const distB = Math.abs(input.zscore - cutoffB);
      if (Math.abs(distA - distB) > 0.0001) {
        return distA - distB;
      }
      return cutoffB - cutoffA;
    });

  groups.competitiveOptions = sortByNearestZScore(groups.competitiveOptions);
  groups.nearHistoricalRange = sortByNearestZScore(groups.nearHistoricalRange);
  groups.strongMatches = sortByNearestZScore(groups.strongMatches);
  groups.notEligible = sortByNearestZScore(groups.notEligible);

  return {
    ...checkerResponse(input, mode, groups),
    message: responseMessage(groups, mode, candidates.length),
  };
}

export async function getCheckerRecommendations(
  input: CheckerRecommendationRequest,
): Promise<CheckerRecommendationsResponse> {
  const { mode, editionId } = await getModeForYear(input.academicYear);
  const candidates = await listCandidateProgrammes(input.academicYear, mode, input.stream);
  const requirementsByProgramme = candidates.length > 0
    ? await getRequirementsByProgramme(
      candidates.map((programme) => programme.id),
      input.academicYear,
    )
    : new Map<number, ProgrammeChecks>();

  return buildCheckerRecommendations(input, {
    mode,
    editionId,
    candidates,
    requirementsByProgramme,
    getOfficialCutoff,
    getVerifiedHistoryBeforeYear,
    getHandbookLabel,
    persistEstimate,
  });
}
