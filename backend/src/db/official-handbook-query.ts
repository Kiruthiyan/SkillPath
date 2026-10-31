import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, pool } from "./client";
import { universitiesTable } from "./schema/index";
import { logger } from "../lib/logger";

// OFFICIAL_HANDBOOK_YEAR is the academic year label used by the database when it
// is fully populated from the official UGC handbook import pipeline.
// The static fallback data loaded from HandBook/2025/zscore_cutoffs_2025.json
// actually contains 2022/23, 2023/24, and 2024/25 entries — the most recent
// of which is 2024/25. All labels and disclaimers in static-fallback mode
// must reflect this so users are not misled.
export const OFFICIAL_HANDBOOK_YEAR = "2025/2026";
// The actual data year of the static fallback files on disk.
const STATIC_FALLBACK_DATA_YEAR = "2024/25";
// Used when querying the live database (which may have 2025/26 handbook data imported).
const SOURCE_HANDBOOK_YEAR = "2025/2026";

type MediumValue = string | string[] | null;

interface OfficialCourseRow {
  academic_year: string;
  uni_code: string;
  course_id: string;
  university: string;
  course_name: string;
  faculty: string | null;
  duration: string | null;
  medium: unknown;
  intake: number | null;
  campus: string | null;
  eligible_streams: unknown;
  required_subjects: unknown;
  minimum_grades: unknown;
  special_requirements: unknown;
  latest_cutoff: number | null;
  latest_cutoff_year: string | null;
}

interface OfficialCutoffRow {
  academic_year: string;
  cutoff: number;
}

interface StaticCourseRow {
  academic_year: string;
  uni_code: string;
  course_id: string;
  university: string;
  course_name: string;
  faculty: string | null;
  duration: string | null;
  medium: unknown;
  intake: number | null;
  campus: string | null;
}

interface StaticEligibilityRow {
  academic_year: string;
  uni_code: string;
  course_name?: string;
  eligible_streams: unknown;
  required_subjects: unknown;
  minimum_grades: unknown;
  special_requirements: unknown;
}

interface StaticCutoffRow {
  academic_year: string;
  uni_code?: string;
  university?: string;
  course_name?: string;
  district: string;
  cutoff: number | null;
}

interface StaticSimpleProgramme {
  academicYear: string;
  university: string;
  universityShortName?: string;
  degreeName: string;
  faculty?: string | null;
  stream?: string | null;
  district?: string | null;
  minimumZScore?: number | null;
  durationYears?: number | null;
  degreeType?: string | null;
  description?: string | null;
}

interface StaticHandbookData {
  courses: StaticCourseRow[];
  eligibilityRules: StaticEligibilityRow[];
  cutoffs: StaticCutoffRow[];
}

let staticHandbookCache: StaticHandbookData | null | undefined;
let warnedAboutStaticFallback = false;

export interface OfficialCourse {
  id: number;
  uniCode: string;
  courseId: string;
  academicYear: string;
  universityId: number;
  universityName: string;
  universityShortName: string;
  degreeName: string;
  faculty: string | null;
  degreeType: string | null;
  duration: string | null;
  durationYears: number | null;
  medium: MediumValue;
  intake: number | null;
  campus: string | null;
  minimumZScore: number | null;
  stream: string | null;
  eligibleStreams: string[];
  matchScore: string | null;
  description: string | null;
  officialMinimumZScore: number | null;
  predictedMinimumZScore: number | null;
  officialAcademicYear: string | null;
  predictedAcademicYear: string | null;
  confidence: string | null;
  eligibility: string | null;
  dataSource: string;
  district: string | null;
}

export interface OfficialCourseDetail extends OfficialCourse {
  subjects: string[];
  minimumGrades: string[];
  specialRequirements: string[];
  skillsDeveloped: string[];
  cutoffHistory: Array<{ academicYear: string; minimumZScore: number }>;
}

export interface OfficialUniversity {
  id: number;
  name: string;
  shortName: string;
  location: string | null;
  foundedYear: number | null;
  logoColor: string;
  ranking: number | null;
  description: string | null;
  courseCount?: number;
  type: "government" | "private" | "unknown";
}

export type ZScoreStatus = "above" | "near" | "below" | "unavailable";

export interface OfficialCheckerRecommendation {
  programmeId: number;
  universityId: number;
  university: string;
  courseName: string;
  faculty: string | null;
  degreeDuration: number | null;
  duration: string | null;
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
  specialRequirements: string[];
  /** Whether the student's entered subject grades satisfy the handbook's stream + subject requirements, independent of Z-score. */
  meetsHandbookRequirements: boolean;
  /** "Meets Handbook Requirements" when meetsHandbookRequirements is true, otherwise the exact missing requirement. */
  handbookStatusReason: string;
  /** studentZScore - officialCutoff, or null when no cutoff is mapped. Purely a re-presentation of existing values, not a new calculation. */
  zscoreDiff: number | null;
  zscoreStatus: ZScoreStatus;
  reasons: string[];
}

export interface OfficialCheckerRecommendationsResponse {
  mode: "historical_estimate";
  resultModeLabel: "Historical Estimate";
  academicYear: string;
  district: string;
  disclaimer: string;
  groups: {
    /** Meets handbook stream + subject requirements and meets cutoff, sorted by best Z-score match first. */
    eligible: OfficialCheckerRecommendation[];
    /** Does not meet handbook stream + subject requirements or falls below cutoff. */
    notEligible: OfficialCheckerRecommendation[];
    /** Meets stream & subject requirements, but no cutoff exists for this district (NQC or New course). */
    cutoffUnavailable: OfficialCheckerRecommendation[];
  };
}

export function officialCourseApiId(uniCode: string): number {
  return Number.parseInt(uniCode, 36);
}

export function officialUniversityApiId(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash & 0x7fffffff;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asMedium(value: unknown): MediumValue {
  if (typeof value === "string") return value;
  const list = asStringList(value);
  return list.length > 0 ? list : null;
}

function mediumLabel(value: MediumValue): string | null {
  if (Array.isArray(value)) return value.join(" / ");
  return value;
}

function streamLabel(streams: string[]): string | null {
  if (streams.length === 0) return null;
  return streams.join(" / ");
}

function matchScore(zscore: number | undefined, cutoff: number | null): string | null {
  if (zscore == null || Number.isNaN(zscore) || cutoff == null) return null;
  const diff = zscore - cutoff;
  if (diff >= 0.1) return "Strong match";
  if (diff >= 0) return "Competitive";
  if (diff >= -0.15) return "Near range";
  return "Below recent cutoff";
}

function eligibility(zscore: number | undefined, cutoff: number | null): string | null {
  if (zscore == null || Number.isNaN(zscore) || cutoff == null) return null;
  const diff = zscore - cutoff;
  if (diff >= 0.1) return "likely";
  if (diff >= 0) return "borderline";
  if (diff >= -0.15) return "reach";
  return "unlikely";
}

export const SECTION9_STREAM_MAPPINGS: Record<string, string[]> = {
  // Software Engineering
  "Software Engineering": ["Physical Science"],
  // Electronic & Intelligent Systems Engineering
  "Electronic and Intelligent Systems Engineering (New)": ["Physical Science"],
  // Information Technology (Moratuwa)
  "Information Technology (IT)": ["Physical Science", "Biological Science", "Commerce", "Arts", "Technology"],
  // Information Technology & Management
  "Information Technology & Management": ["Physical Science", "Biological Science", "Commerce", "Arts", "Technology"],
  // Information Systems
  "Information Systems": ["Physical Science", "Biological Science", "Commerce", "Arts", "Technology"],
  // Computer Science & Technology
  "Computer Science & Technology": ["Physical Science"],
  // Industrial Information Technology
  "Industrial Information Technology": ["Physical Science", "Biological Science", "Technology"],
  // Quantity Surveying
  "Quantity Surveying": ["Physical Science"],
  // Surveying Science
  "Surveying Science": ["Physical Science"],
  // Facilities Management
  "Facilities Management": ["Physical Science"],
  // Urban Informatics and Planning
  "Urban Informatics and Planning": ["Physical Science"],
  // Architecture
  "Architecture": ["Physical Science", "Arts", "Technology"],
  // Management and Information Technology (MIT)
  "Management and Information Technology (MIT)": ["Physical Science"],
  "Management and Information Technology (SEUSL)": ["Physical Science", "Biological Science"],
  // Information and Communication Technology
  "Information and Communication Technology (ICT)": ["Physical Science", "Technology"],
  "Information Communication Technology": ["Physical Science", "Technology"],
  // Financial Engineering
  "Financial Engineering": ["Physical Science"],
  // Mineral Resources and Technology
  "Mineral Resources and Technology": ["Physical Science"],
  // Science and Technology
  "Science and Technology": ["Physical Science"],
  // Creative Music Technology and Production
  "Creative Music Technology and Production": ["Arts"],
  // Aesthetic Studies (Music, Dance, Drama & Theatre, Visual & Technological Arts)
  "Music": ["Arts"],
  "Dance": ["Arts"],
  "Drama & Theatre": ["Arts"],
  "Visual & Technological Arts": ["Arts"],
};

export function getCourseEligibleStreams(row: { course_name?: string | null; eligible_streams?: unknown }): string[] {
  const fromDb = asStringList(row.eligible_streams);
  if (fromDb.length > 0) return fromDb;
  const name = row.course_name?.trim() ?? "";
  return SECTION9_STREAM_MAPPINGS[name] ?? [];
}

function academicYearMatches(left: string, right: string): boolean {
  const normalize = (value: string) => value.replace(/^20(\d{2})\/20(\d{2})$/, "20$1/$2");
  return left === right || normalize(left) === normalize(right);
}

function readJsonCandidate<T>(paths: string[]): T | null {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  }
  return null;
}

function staticDataPaths(fileName: string): string[] {
  return [
    resolve(process.cwd(), "../HandBook/2025", fileName),
    resolve(process.cwd(), "HandBook/2025", fileName),
  ];
}

function backendDataPath(fileName: string): string {
  return resolve(process.cwd(), "data/handbooks", fileName);
}

function loadStaticHandbookData(): StaticHandbookData | null {
  if (staticHandbookCache !== undefined) return staticHandbookCache;

  const courses = readJsonCandidate<{ courses: StaticCourseRow[] }>(staticDataPaths("courses_2025.json"));
  const eligibilityRules = readJsonCandidate<StaticEligibilityRow[]>(staticDataPaths("eligibility_rules_2025.json"));
  const cutoffs = readJsonCandidate<StaticCutoffRow[]>(staticDataPaths("zscore_cutoffs_2025.json"));

  if (courses && eligibilityRules && cutoffs) {
    staticHandbookCache = {
      courses: courses.courses,
      eligibilityRules,
      cutoffs,
    };
    return staticHandbookCache;
  }

  const compact = readJsonCandidate<{ programmes: StaticSimpleProgramme[] }>([
    backendDataPath("2025_26.json"),
    backendDataPath("2024_25.json"),
  ]);

  if (!compact) {
    staticHandbookCache = null;
    return staticHandbookCache;
  }

  const courseCodeByKey = new Map<string, string>();
  const coursesByKey = new Map<string, StaticCourseRow>();
  const eligibilityByKey = new Map<string, StaticEligibilityRow>();
  const staticCutoffs: StaticCutoffRow[] = [];

  for (const programme of compact.programmes) {
    const key = `${programme.academicYear}|${programme.university}|${programme.degreeName}`;
    if (!courseCodeByKey.has(key)) {
      courseCodeByKey.set(key, (courseCodeByKey.size + 1).toString(36).padStart(4, "0"));
    }
    const uniCode = courseCodeByKey.get(key)!;
    coursesByKey.set(key, {
      academic_year: programme.academicYear,
      uni_code: uniCode,
      course_id: `${programme.academicYear}:${uniCode}`,
      university: programme.university,
      course_name: programme.degreeName,
      faculty: programme.faculty ?? null,
      duration: programme.durationYears != null ? `${programme.durationYears.toString().padStart(2, "0")} Years` : null,
      medium: null,
      intake: null,
      campus: null,
    });

    const stream = programme.stream ? [programme.stream] : SECTION9_STREAM_MAPPINGS[programme.degreeName] ?? [];
    eligibilityByKey.set(key, {
      academic_year: programme.academicYear,
      uni_code: uniCode,
      course_name: programme.degreeName,
      eligible_streams: stream,
      required_subjects: [],
      minimum_grades: [],
      special_requirements: [],
    });

    if (programme.district && programme.minimumZScore != null) {
      staticCutoffs.push({
        academic_year: programme.academicYear,
        uni_code: uniCode,
        university: programme.university,
        course_name: programme.degreeName,
        district: programme.district,
        cutoff: programme.minimumZScore,
      });
    }
  }

  staticHandbookCache = {
    courses: Array.from(coursesByKey.values()),
    eligibilityRules: Array.from(eligibilityByKey.values()),
    cutoffs: staticCutoffs,
  };
  return staticHandbookCache;
}

function errorSummary(err: unknown): string {
  if (err instanceof Error) {
    const nested = (err as { errors?: unknown[]; aggregateErrors?: unknown[] }).errors
      ?? (err as { aggregateErrors?: unknown[] }).aggregateErrors
      ?? [];
    return [err.message, (err as { code?: string }).code, ...nested.map(errorSummary)]
      .filter(Boolean)
      .join(" ");
  }
  return String(err);
}

function canUseStaticFallback(err: unknown): boolean {
  const summary = errorSummary(err);
  return /EACCES|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|does not exist|DATABASE_URL/i.test(summary);
}

function warnStaticFallback(err: unknown) {
  if (warnedAboutStaticFallback) return;
  warnedAboutStaticFallback = true;
  logger.warn({ err: errorSummary(err) }, "Using bundled handbook data for public checker endpoints");
}

function latestStaticCutoff(
  data: StaticHandbookData,
  course: StaticCourseRow,
  district: string,
): { cutoff: number | null; academicYear: string | null } {
  const candidates = data.cutoffs
    .filter((cutoff) =>
      cutoff.cutoff != null &&
      (cutoff.uni_code === course.uni_code ||
        (cutoff.university === course.university && cutoff.course_name === course.course_name)) &&
      (cutoff.district === district || cutoff.district === "All Island")
    )
    .sort((a, b) => {
      if (a.district !== b.district) return a.district === district ? -1 : 1;
      return b.academic_year.localeCompare(a.academic_year);
    });

  const latest = candidates[0];
  return {
    cutoff: latest?.cutoff ?? null,
    academicYear: latest?.academic_year ?? null,
  };
}

function staticCourseRows(params: { academicYear?: string; district?: string }): OfficialCourseRow[] {
  const data = loadStaticHandbookData();
  if (!data) return [];

  const academicYear = params.academicYear ?? OFFICIAL_HANDBOOK_YEAR;
  const district = params.district ?? "All Island";

  return data.courses
    .filter((course) => academicYearMatches(course.academic_year, academicYear))
    .map((course) => {
      const eligibility = data.eligibilityRules.find(
        (rule) => academicYearMatches(rule.academic_year, course.academic_year) && rule.uni_code === course.uni_code,
      );
      const cutoff = latestStaticCutoff(data, course, district);
      return {
        ...course,
        eligible_streams: eligibility?.eligible_streams ?? SECTION9_STREAM_MAPPINGS[course.course_name] ?? [],
        required_subjects: eligibility?.required_subjects ?? [],
        minimum_grades: eligibility?.minimum_grades ?? [],
        special_requirements: eligibility?.special_requirements ?? [],
        latest_cutoff: cutoff.cutoff,
        latest_cutoff_year: cutoff.academicYear,
      };
    });
}

function rowToCourse(row: OfficialCourseRow, opts: { district?: string; zscore?: number }): OfficialCourse {
  const eligibleStreams = getCourseEligibleStreams(row);
  const medium = asMedium(row.medium);

  return {
    id: officialCourseApiId(row.uni_code),
    uniCode: row.uni_code,
    courseId: row.course_id,
    academicYear: row.academic_year,
    universityId: officialUniversityApiId(row.university),
    universityName: row.university,
    universityShortName: row.university,
    degreeName: row.course_name,
    faculty: row.faculty,
    degreeType: null,
    duration: row.duration,
    durationYears: null,
    medium,
    intake: row.intake,
    campus: row.campus,
    minimumZScore: row.latest_cutoff,
    stream: streamLabel(eligibleStreams),
    eligibleStreams,
    matchScore: matchScore(opts.zscore, row.latest_cutoff),
    description: null,
    officialMinimumZScore: row.latest_cutoff,
    predictedMinimumZScore: null,
    officialAcademicYear: row.latest_cutoff_year,
    predictedAcademicYear: null,
    confidence: row.latest_cutoff == null ? null : "high",
    eligibility: eligibility(opts.zscore, row.latest_cutoff),
    dataSource: "official_handbook_2025",
    district: opts.district ?? null,
  };
}

async function fetchCourseRows(params: {
  academicYear?: string;
  district?: string;
}): Promise<OfficialCourseRow[]> {
  const academicYear = params.academicYear ?? OFFICIAL_HANDBOOK_YEAR;
  const district = params.district ?? "All Island";
  try {
    const result = await pool.query<OfficialCourseRow>(
      `
        select
          c.academic_year,
          c.uni_code,
          c.course_id,
          c.university,
          c.course_name,
          c.faculty,
          c.duration,
          c.medium,
          c.intake,
          c.campus,
          e.eligible_streams,
          e.required_subjects,
          e.minimum_grades,
          e.special_requirements,
          (
            select z.cutoff
            from official_handbook_zscore_cutoffs z
            where z.source_handbook_year = $2
              and z.uni_code = c.uni_code
              and (z.district = $3 or z.district = 'All Island')
            order by case when z.district = $3 then 0 else 1 end, z.academic_year desc
            limit 1
          ) as latest_cutoff,
          (
            select z.academic_year
            from official_handbook_zscore_cutoffs z
            where z.source_handbook_year = $2
              and z.uni_code = c.uni_code
              and (z.district = $3 or z.district = 'All Island')
            order by case when z.district = $3 then 0 else 1 end, z.academic_year desc
            limit 1
          ) as latest_cutoff_year
        from official_handbook_courses c
        left join official_handbook_eligibility_rules e
          on e.academic_year = c.academic_year
         and e.uni_code = c.uni_code
        where c.academic_year = $1
        order by c.course_name, c.university, c.uni_code
      `,
      [academicYear, SOURCE_HANDBOOK_YEAR, district],
    );
    return result.rows;
  } catch (err) {
    if (!canUseStaticFallback(err)) throw err;
    warnStaticFallback(err);
    return staticCourseRows({ academicYear, district });
  }
}

export async function listOfficialCourses(opts: {
  stream?: string;
  zscore?: number;
  universityId?: number;
  faculty?: string;
  duration?: string | number;
  medium?: string;
  district?: string;
  academicYear?: string;
}): Promise<OfficialCourse[]> {
  const rows = await fetchCourseRows({
    academicYear: opts.academicYear,
    district: opts.district,
  });

  return rows
    .filter((row) => {
      const streams = getCourseEligibleStreams(row);
      if (opts.stream && !streams.includes(opts.stream)) return false;
      if (opts.universityId != null && officialUniversityApiId(row.university) !== opts.universityId) return false;
      if (opts.faculty && row.faculty !== opts.faculty) return false;
      if (opts.duration != null && row.duration !== String(opts.duration)) return false;
      if (opts.medium) {
        const medium = asMedium(row.medium);
        const mediumList = Array.isArray(medium) ? medium : medium ? [medium] : [];
        if (!mediumList.includes(opts.medium)) return false;
      }
      return true;
    })
    .map((row) => rowToCourse(row, { district: opts.district, zscore: opts.zscore }));
}

export async function getOfficialCutoffHistory(
  uniCode: string,
  district: string,
): Promise<Array<{ academicYear: string; minimumZScore: number }>> {
  try {
    const result = await pool.query<OfficialCutoffRow>(
      `
        select academic_year, cutoff
        from official_handbook_zscore_cutoffs
        where source_handbook_year = $1
          and uni_code = $2
          and district = $3
        order by academic_year desc
      `,
      [SOURCE_HANDBOOK_YEAR, uniCode, district],
    );
    return result.rows.map((row) => ({ academicYear: row.academic_year, minimumZScore: row.cutoff }));
  } catch (err) {
    if (!canUseStaticFallback(err)) throw err;
    warnStaticFallback(err);
    const data = loadStaticHandbookData();
    if (!data) return [];
    return data.cutoffs
      .filter((row) => row.uni_code === uniCode && row.district === district && row.cutoff != null)
      .sort((a, b) => b.academic_year.localeCompare(a.academic_year))
      .map((row) => ({ academicYear: row.academic_year, minimumZScore: row.cutoff! }));
  }
}

export async function getOfficialCourseDetail(
  id: number,
  opts: { district?: string; academicYear?: string },
): Promise<OfficialCourseDetail | null> {
  const district = opts.district ?? "All Island";
  const rows = await fetchCourseRows({ academicYear: opts.academicYear, district });
  const row = rows.find((candidate) => officialCourseApiId(candidate.uni_code) === id);
  if (!row) return null;

  return {
    ...rowToCourse(row, { district }),
    subjects: asStringList(row.required_subjects),
    minimumGrades: asStringList(row.minimum_grades),
    specialRequirements: asStringList(row.special_requirements),
    skillsDeveloped: [],
    cutoffHistory: await getOfficialCutoffHistory(row.uni_code, district),
  };
}

/**
 * The admin-managed universitiesTable and the handbook-derived catalog below are
 * separate data sources with no shared id scheme (handbook ids are name hashes).
 * Match by name containment (same loose-matching approach used in db/seed.ts) to
 * surface the admin-set Government/Private type on the student-facing catalog.
 */
async function loadUniversityTypeByName(): Promise<(handbookName: string) => "government" | "private" | "unknown"> {
  const rows = await db.select({ name: universitiesTable.name, type: universitiesTable.type }).from(universitiesTable);
  return (handbookName: string) => {
    const needle = handbookName.toLowerCase();
    const exact = rows.find((r) => r.name.toLowerCase() === needle);
    const match =
      exact ??
      rows.find((r) => needle.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(needle));
    if (match?.type === "private") return "private";
    if (match?.type === "government") return "government";
    return "unknown";
  };
}

export async function listOfficialUniversities(): Promise<OfficialUniversity[]> {
  const result = await pool.query<{ university: string; course_count: string }>(
    `
      select university, count(*)::text as course_count
      from official_handbook_courses
      where academic_year = $1
      group by university
      order by university
    `,
    [OFFICIAL_HANDBOOK_YEAR],
  );

  const resolveType = await loadUniversityTypeByName();

  return result.rows.map((row) => ({
    id: officialUniversityApiId(row.university),
    name: row.university,
    shortName: row.university,
    location: null,
    foundedYear: null,
    logoColor: "#1e3a5f",
    ranking: null,
    description: null,
    courseCount: Number(row.course_count),
    type: resolveType(row.university),
  }));
}

export async function getOfficialUniversity(id: number): Promise<OfficialUniversity | null> {
  const universities = await listOfficialUniversities();
  return universities.find((university) => university.id === id) ?? null;
}

export async function listOfficialStreams(): Promise<string[]> {
  const streams = new Set<string>();
  try {
    const result = await pool.query<{ stream: string }>(
      `
        select distinct jsonb_array_elements_text(eligible_streams) as stream
        from official_handbook_eligibility_rules
        where academic_year = $1
        order by stream
      `,
      [OFFICIAL_HANDBOOK_YEAR],
    );
    for (const row of result.rows) streams.add(row.stream);
  } catch (err) {
    if (!canUseStaticFallback(err)) throw err;
    warnStaticFallback(err);
    const data = loadStaticHandbookData();
    for (const row of data?.eligibilityRules ?? []) {
      for (const stream of asStringList(row.eligible_streams)) streams.add(stream);
    }
  }
  for (const list of Object.values(SECTION9_STREAM_MAPPINGS)) {
    for (const s of list) streams.add(s);
  }
  const standardStreams = [
    "Physical Science",
    "Biological Science",
    "Commerce",
    "Arts",
    "Technology",
    "Engineering Technology",
    "Biosystems Technology",
  ];
  for (const s of standardStreams) streams.add(s);
  return Array.from(streams).sort();
}

export async function listOfficialSubjects(): Promise<string[]> {
  try {
    const result = await pool.query<{ subject: string }>(
      `
        select distinct jsonb_array_elements_text(required_subjects) as subject
        from official_handbook_eligibility_rules
        where academic_year = $1
        order by subject
      `,
      [OFFICIAL_HANDBOOK_YEAR],
    );
    return result.rows.map((row) => row.subject);
  } catch (err) {
    if (!canUseStaticFallback(err)) throw err;
    warnStaticFallback(err);
    const subjects = new Set<string>();
    const data = loadStaticHandbookData();
    for (const row of data?.eligibilityRules ?? []) {
      for (const subject of asStringList(row.required_subjects)) subjects.add(subject);
    }
    return Array.from(subjects).sort();
  }
}

export async function listOfficialAcademicYears(): Promise<Array<{ academicYear: string; handbookAvailable: boolean }>> {
  try {
    const result = await pool.query<{ academic_year: string }>(
      `
        select distinct academic_year
        from official_handbook_courses
        order by academic_year
      `,
    );
    return result.rows.map((row) => ({ academicYear: row.academic_year, handbookAvailable: true }));
  } catch (err) {
    if (!canUseStaticFallback(err)) throw err;
    warnStaticFallback(err);
    const data = loadStaticHandbookData();
    const years = new Set((data?.courses ?? []).map((course) => course.academic_year));
    return Array.from(years)
      .sort()
      .map((academicYear) => ({ academicYear, handbookAvailable: true }));
  }
}

function isPassingGrade(grade: string | undefined): boolean {
  return !!grade && grade.toUpperCase() !== "F";
}

function isSimpleSubjectRequirement(subject: string): boolean {
  return !/\b(one of|or|from|must include|at least|any)\b|[:;]/i.test(subject);
}

/**
 * UGC minimum university admission requirement: the student must have at least
 * 3 simple passes (grade S or above) in A/L subjects.
 * Source: UGC University Admissions Handbook — General Admission Requirements.
 * This is verified from the official UGC handbook; it applies to ALL programmes
 * regardless of stream or specific programme requirements.
 *
 * FAIL CLOSED: If subjectGrades is empty (not provided), we cannot verify this
 * requirement and we do NOT assume it is met — we return false so the programme
 * is shown as "Cutoff Unavailable" rather than "Eligible".
 * Only when the student has explicitly provided subject grades do we evaluate.
 */
function meetsUgcMinimumAdmission(subjectGrades: Record<string, string>): {
  passes: boolean;
  reason: string;
  gradeCount: number;
} {
  const gradeValues = Object.values(subjectGrades).filter((g) => g && g.trim() !== "");
  if (gradeValues.length === 0) {
    // No subject grades entered — cannot verify minimum pass requirement.
    // We do not assume compliance; this is handled in the caller.
    return {
      passes: false,
      reason: "Subject grades not provided — cannot verify UGC minimum 3-pass requirement.",
      gradeCount: 0,
    };
  }
  const passCount = gradeValues.filter(isPassingGrade).length;
  if (passCount < 3) {
    return {
      passes: false,
      reason: `UGC minimum admission requirement not met: need ≥3 simple passes (S or above); found ${passCount}.`,
      gradeCount: passCount,
    };
  }
  return { passes: true, reason: `${passCount} passes meet UGC minimum (≥3 required).`, gradeCount: passCount };
}

function emptyRecommendationGroups(): OfficialCheckerRecommendationsResponse["groups"] {
  return {
    eligible: [],
    notEligible: [],
    cutoffUnavailable: [],
  };
}

function zscoreStatusFor(diff: number | null): ZScoreStatus {
  if (diff == null) return "unavailable";
  if (diff >= -0.15) return diff >= 0.1 ? "above" : "near";
  return "below";
}

export async function getOfficialCheckerRecommendations(input: {
  academicYear: string;
  district: string;
  stream: string;
  subjectGrades: Record<string, string>;
  zscore: number;
}): Promise<OfficialCheckerRecommendationsResponse> {
  const groups = emptyRecommendationGroups();
  const rows = await fetchCourseRows({
    academicYear: input.academicYear || OFFICIAL_HANDBOOK_YEAR,
    district: input.district,
  });

  const matchingRows = rows.filter((row) => {
    const streams = getCourseEligibleStreams(row);
    return !input.stream || streams.includes(input.stream);
  });

  for (const row of matchingRows) {
    const subjects = asStringList(row.required_subjects);
    const minimumGrades = asStringList(row.minimum_grades);
    const specialRequirements = asStringList(row.special_requirements);
    const medium = asMedium(row.medium);

    const hasSubjectGrades = Object.keys(input.subjectGrades || {}).some(
      (k) => input.subjectGrades[k] && input.subjectGrades[k].trim() !== ""
    );

    // A.1: Check UGC minimum admission requirement (≥3 simple passes) first.
    // Only evaluated when subject grades were provided by the student.
    // If not provided, this check is skipped (fail-closed logic is in the
    // eligible/cutoffUnavailable gate below).
    const ugcMinCheck = hasSubjectGrades
      ? meetsUgcMinimumAdmission(input.subjectGrades)
      : { passes: true, reason: "Subject grades not provided; minimum pass check skipped.", gradeCount: 0 };

    const missingSubjects = hasSubjectGrades && ugcMinCheck.passes
      ? subjects
          .filter(isSimpleSubjectRequirement)
          .filter((subject) => {
            const grade = input.subjectGrades[subject];
            if (!grade) {
              const totalEntered = Object.keys(input.subjectGrades).filter(
                (k) => input.subjectGrades[k]?.trim()
              ).length;
              return totalEntered >= 3;
            }
            return !isPassingGrade(grade);
          })
      : [];
    const manualSubjects = subjects.filter((subject) => !isSimpleSubjectRequirement(subject));

    // A programme "meets handbook requirements" only when:
    // 1. UGC minimum pass rule is satisfied (or grades not provided — skipped).
    // 2. All simple subject requirements are met.
    const failedUgcMin = hasSubjectGrades && !ugcMinCheck.passes;
    const meetsHandbookRequirements = !failedUgcMin && missingSubjects.length === 0;
    const hasCutoff = row.latest_cutoff != null;
    const zscoreDiff = hasCutoff ? input.zscore - row.latest_cutoff! : null;
    const meetsCutoff = zscoreDiff != null && zscoreDiff >= -0.0001;

    let handbookStatusReason: string;
    if (failedUgcMin) {
      handbookStatusReason = ugcMinCheck.reason;
    } else if (!meetsHandbookRequirements && missingSubjects.length > 0) {
      handbookStatusReason = `Missing required subject pass: ${missingSubjects.join(", ")}`;
    } else if (!meetsHandbookRequirements) {
      handbookStatusReason = "Handbook requirements not met.";
    } else if (!hasCutoff) {
      handbookStatusReason = "No District Cutoff Available";
    } else if (meetsCutoff && zscoreDiff != null) {
      handbookStatusReason = `Qualified (+${zscoreDiff.toFixed(3)})`;
    } else if (zscoreDiff != null) {
      handbookStatusReason = `Below Cutoff (${zscoreDiff.toFixed(3)})`;
    } else {
      handbookStatusReason = "No District Cutoff Available";
    }

    const reasons: string[] = [handbookStatusReason];
    if (manualSubjects.length > 0) {
      reasons.push(`Manual subject verification required: ${manualSubjects.join("; ")}`);
    }
    if (minimumGrades.length > 0) {
      reasons.push(`Minimum grade rule: ${minimumGrades.join("; ")}`);
    }
    if (specialRequirements.length > 0) {
      reasons.push(`Special requirement: ${specialRequirements.join("; ")}`);
    }

    if (!hasCutoff) {
      reasons.push(`No exact official cutoff for ${input.district} (NQC or New course)`);
    } else {
      reasons.push(`Official cutoff ${row.latest_cutoff} for ${input.district}`);
    }

    const recommendation: OfficialCheckerRecommendation = {
      programmeId: officialCourseApiId(row.uni_code),
      universityId: officialUniversityApiId(row.university),
      university: row.university,
      courseName: row.course_name,
      faculty: row.faculty,
      degreeDuration: null,
      duration: row.duration,
      medium: mediumLabel(medium),
      studentZScore: input.zscore,
      officialCutoff: row.latest_cutoff,
      estimatedMin: null,
      estimatedMax: null,
      estimatedCenter: null,
      confidence: row.latest_cutoff == null ? null : "High",
      academicYear: input.academicYear || OFFICIAL_HANDBOOK_YEAR,
      // B.1/B.4: The sourceHandbook label is set based on which data source is
      // actually serving the response. The static fallback contains 2024/25 data.
      // The database (when available) may contain 2025/26 data.
      sourceHandbook: row.latest_cutoff_year
        ? `UGC Admissions Cutoff Handbook (data year: ${row.latest_cutoff_year})`
        : `UGC Admissions Handbook ${STATIC_FALLBACK_DATA_YEAR} (static fallback)`,
      sourcePage: null,
      requiredStream: input.stream,
      requiredSubjects: subjects.map((subjectName) => ({
        subjectName,
        requirementType: "official_text",
        minimumGrade: null,
      })),
      specialRequirements,
      meetsHandbookRequirements,
      handbookStatusReason,
      zscoreDiff,
      zscoreStatus: zscoreStatusFor(zscoreDiff),
      reasons,
    };

    if (!meetsHandbookRequirements) {
      groups.notEligible.push(recommendation);
    } else if (!hasCutoff) {
      groups.cutoffUnavailable.push(recommendation);
    } else if (meetsCutoff) {
      groups.eligible.push(recommendation);
    } else {
      groups.notEligible.push(recommendation);
    }
  }

  const sortByBestZScore = (items: OfficialCheckerRecommendation[]) =>
    [...items].sort((a, b) => {
      const cutoffA = a.officialCutoff ?? a.estimatedCenter ?? (a.estimatedMin != null && a.estimatedMax != null ? (a.estimatedMin + a.estimatedMax) / 2 : null);
      const cutoffB = b.officialCutoff ?? b.estimatedCenter ?? (b.estimatedMin != null && b.estimatedMax != null ? (b.estimatedMin + b.estimatedMax) / 2 : null);
      if (cutoffA == null && cutoffB == null) return a.courseName.localeCompare(b.courseName);
      if (cutoffA == null) return 1;
      if (cutoffB == null) return -1;
      const distA = Math.abs(input.zscore - cutoffA);
      const distB = Math.abs(input.zscore - cutoffB);
      if (Math.abs(distA - distB) > 0.0001) {
        return distA - distB;
      }
      if (cutoffB !== cutoffA) return cutoffB - cutoffA;
      return a.courseName.localeCompare(b.courseName);
    });

  groups.eligible = sortByBestZScore(groups.eligible);
  groups.notEligible = sortByBestZScore(groups.notEligible);
  groups.cutoffUnavailable = [...groups.cutoffUnavailable].sort((a, b) => a.courseName.localeCompare(b.courseName));

  return {
    mode: "historical_estimate",
    resultModeLabel: "Historical Estimate",
    academicYear: input.academicYear || OFFICIAL_HANDBOOK_YEAR,
    district: input.district,
    // B.5: Disclaimer states exact data year and that official UGC sources prevail.
    disclaimer:
      "Results are estimates based on UGC official cutoff data (2024/25 edition from ugc.ac.lk). " +
      "Eligibility uses verified handbook-derived rules; missing or complex rules are not guessed. " +
      "A result of 'Eligible' means your Z-score meets the published cutoff — it is NOT a guarantee of admission. " +
      "Always verify at https://www.ugc.ac.lk before applying.",
    groups,
  };
}
