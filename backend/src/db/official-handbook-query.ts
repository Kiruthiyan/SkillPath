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
    /** Meets handbook stream + subject requirements, sorted by best Z-score match first. */
    eligible: OfficialCheckerRecommendation[];
    /** Does not meet handbook stream + subject requirements. */
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
};

export function getCourseEligibleStreams(row: { course_name?: string | null; eligible_streams?: unknown }): string[] {
  const fromDb = asStringList(row.eligible_streams);
  if (fromDb.length > 0) return fromDb;
  const name = row.course_name?.trim() ?? "";
  return SECTION9_STREAM_MAPPINGS[name] ?? [];
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
  const streams = new Set(result.rows.map((row) => row.stream));
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
    eligible: [],
    notEligible: [],
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

    const missingSubjects = hasSubjectGrades
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

    const meetsHandbookRequirements = missingSubjects.length === 0;
    const zscoreDiff = row.latest_cutoff == null ? null : input.zscore - row.latest_cutoff;
    const meetsCutoff = zscoreDiff != null && zscoreDiff >= -0.0001;
    const isEligible = meetsHandbookRequirements && meetsCutoff;

    let handbookStatusReason: string;
    if (!meetsHandbookRequirements) {
      handbookStatusReason = `Missing required subject pass: ${missingSubjects.join(", ")}`;
    } else if (row.latest_cutoff == null) {
      handbookStatusReason = "No District Cutoff Available";
    } else if (meetsCutoff) {
      handbookStatusReason = `Qualified (+${zscoreDiff.toFixed(3)})`;
    } else {
      handbookStatusReason = `Below Cutoff (${zscoreDiff.toFixed(3)})`;
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

    if (row.latest_cutoff == null) {
      reasons.push(`No exact official cutoff mapping for ${input.district}`);
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
      sourceHandbook: `UGC Admissions Handbook ${SOURCE_HANDBOOK_YEAR}`,
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

    if (isEligible) {
      groups.eligible.push(recommendation);
    } else {
      groups.notEligible.push(recommendation);
    }
  }

  const sortByBestZScore = (items: OfficialCheckerRecommendation[]) =>
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
      if (cutoffB !== cutoffA) return cutoffB - cutoffA;
      return a.courseName.localeCompare(b.courseName);
    });

  groups.eligible = sortByBestZScore(groups.eligible);
  groups.notEligible = sortByBestZScore(groups.notEligible);

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
