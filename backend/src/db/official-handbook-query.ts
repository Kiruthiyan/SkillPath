import { pool } from "./client";

export const OFFICIAL_HANDBOOK_YEAR = "2025/2026";
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
}

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
  reasons: string[];
}

export interface OfficialCheckerRecommendationsResponse {
  mode: "historical_estimate";
  resultModeLabel: "Historical Estimate";
  academicYear: string;
  district: string;
  disclaimer: string;
  groups: {
    strongMatches: OfficialCheckerRecommendation[];
    competitiveOptions: OfficialCheckerRecommendation[];
    nearHistoricalRange: OfficialCheckerRecommendation[];
    notEligible: OfficialCheckerRecommendation[];
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

function rowToCourse(row: OfficialCourseRow, opts: { district?: string; zscore?: number }): OfficialCourse {
  const eligibleStreams = asStringList(row.eligible_streams);
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
            and z.district = $3
          order by z.academic_year desc
          limit 1
        ) as latest_cutoff,
        (
          select z.academic_year
          from official_handbook_zscore_cutoffs z
          where z.source_handbook_year = $2
            and z.uni_code = c.uni_code
            and z.district = $3
          order by z.academic_year desc
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
}

export async function listOfficialCourses(opts: {
  stream?: string;
  zscore?: number;
  universityId?: number;
  faculty?: string;
  duration?: string | number;
  district?: string;
  academicYear?: string;
}): Promise<OfficialCourse[]> {
  const rows = await fetchCourseRows({
    academicYear: opts.academicYear,
    district: opts.district,
  });

  return rows
    .filter((row) => {
      const streams = asStringList(row.eligible_streams);
      if (opts.stream && !streams.includes(opts.stream)) return false;
      if (opts.universityId != null && officialUniversityApiId(row.university) !== opts.universityId) return false;
      if (opts.faculty && row.faculty !== opts.faculty) return false;
      if (opts.duration != null && row.duration !== String(opts.duration)) return false;
      if (opts.zscore != null && !Number.isNaN(opts.zscore) && row.latest_cutoff != null) {
        return opts.zscore >= row.latest_cutoff - 0.15;
      }
      return true;
    })
    .map((row) => rowToCourse(row, { district: opts.district, zscore: opts.zscore }));
}

export async function getOfficialCutoffHistory(
  uniCode: string,
  district: string,
): Promise<Array<{ academicYear: string; minimumZScore: number }>> {
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
  }));
}

export async function getOfficialUniversity(id: number): Promise<OfficialUniversity | null> {
  const universities = await listOfficialUniversities();
  return universities.find((university) => university.id === id) ?? null;
}

export async function listOfficialStreams(): Promise<string[]> {
  const result = await pool.query<{ stream: string }>(
    `
      select distinct jsonb_array_elements_text(eligible_streams) as stream
      from official_handbook_eligibility_rules
      where academic_year = $1
      order by stream
    `,
    [OFFICIAL_HANDBOOK_YEAR],
  );
  return result.rows.map((row) => row.stream);
}

export async function listOfficialSubjects(): Promise<string[]> {
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
}

export async function listOfficialAcademicYears(): Promise<Array<{ academicYear: string; handbookAvailable: boolean }>> {
  const result = await pool.query<{ academic_year: string }>(
    `
      select distinct academic_year
      from official_handbook_courses
      order by academic_year
    `,
  );
  return result.rows.map((row) => ({ academicYear: row.academic_year, handbookAvailable: true }));
}

function isPassingGrade(grade: string | undefined): boolean {
  return !!grade && grade.toUpperCase() !== "F";
}

function isSimpleSubjectRequirement(subject: string): boolean {
  return !/\b(one of|or|from|must include|at least|any)\b|[:;]/i.test(subject);
}

function emptyRecommendationGroups(): OfficialCheckerRecommendationsResponse["groups"] {
  return {
    strongMatches: [],
    competitiveOptions: [],
    nearHistoricalRange: [],
    notEligible: [],
  };
}

function groupForCutoff(zscore: number, cutoff: number): keyof OfficialCheckerRecommendationsResponse["groups"] {
  const diff = zscore - cutoff;
  if (diff >= 0.1) return "strongMatches";
  if (diff >= 0) return "competitiveOptions";
  if (diff >= -0.15) return "nearHistoricalRange";
  return "notEligible";
}

export async function getOfficialCheckerRecommendations(input: {
  academicYear: string;
  district: string;
  stream: string;
  subjectGrades: Record<string, string>;
  zscore: number;
}): Promise<OfficialCheckerRecommendationsResponse> {
  const groups = emptyRecommendationGroups();
  const courses = await listOfficialCourses({
    academicYear: input.academicYear || OFFICIAL_HANDBOOK_YEAR,
    district: input.district,
    stream: input.stream,
  });

  for (const course of courses) {
    const detail = await getOfficialCourseDetail(course.id, {
      academicYear: input.academicYear || OFFICIAL_HANDBOOK_YEAR,
      district: input.district,
    });
    if (!detail) continue;

    const missingSubjects = detail.subjects
      .filter(isSimpleSubjectRequirement)
      .filter((subject) => !isPassingGrade(input.subjectGrades[subject]));
    const manualSubjects = detail.subjects.filter((subject) => !isSimpleSubjectRequirement(subject));
    const reasons: string[] = [];

    if (missingSubjects.length > 0) {
      reasons.push(`Missing required subject pass: ${missingSubjects.join(", ")}`);
    } else {
      reasons.push(`Stream exactly matches official rule: ${input.stream}`);
    }

    if (manualSubjects.length > 0) {
      reasons.push(`Manual subject verification required: ${manualSubjects.join("; ")}`);
    }
    if (detail.minimumGrades.length > 0) {
      reasons.push(`Minimum grade rule: ${detail.minimumGrades.join("; ")}`);
    }
    if (detail.specialRequirements.length > 0) {
      reasons.push(`Special requirement: ${detail.specialRequirements.join("; ")}`);
    }

    if (course.officialMinimumZScore == null) {
      reasons.push(`No exact official cutoff mapping for ${input.district}`);
    } else {
      reasons.push(`Official cutoff ${course.officialMinimumZScore} for ${input.district}`);
    }

    const recommendation: OfficialCheckerRecommendation = {
      programmeId: detail.id,
      universityId: detail.universityId,
      university: detail.universityName,
      courseName: detail.degreeName,
      faculty: detail.faculty,
      degreeDuration: null,
      duration: detail.duration,
      medium: mediumLabel(detail.medium),
      studentZScore: input.zscore,
      officialCutoff: detail.officialMinimumZScore,
      estimatedMin: null,
      estimatedMax: null,
      estimatedCenter: null,
      confidence: detail.officialMinimumZScore == null ? null : "High",
      academicYear: input.academicYear || OFFICIAL_HANDBOOK_YEAR,
      sourceHandbook: `UGC Admissions Handbook ${SOURCE_HANDBOOK_YEAR}`,
      sourcePage: null,
      requiredStream: input.stream,
      requiredSubjects: detail.subjects.map((subjectName) => ({
        subjectName,
        requirementType: "official_text",
        minimumGrade: null,
      })),
      reasons,
    };

    if (missingSubjects.length > 0 || detail.officialMinimumZScore == null) {
      groups.notEligible.push(recommendation);
    } else {
      groups[groupForCutoff(input.zscore, detail.officialMinimumZScore)].push(recommendation);
    }
  }

  return {
    mode: "historical_estimate",
    resultModeLabel: "Historical Estimate",
    academicYear: input.academicYear || OFFICIAL_HANDBOOK_YEAR,
    district: input.district,
    disclaimer:
      "Results use only exact official handbook-derived eligibility and cutoff mappings. Missing or complex rules are not guessed.",
    groups,
  };
}
