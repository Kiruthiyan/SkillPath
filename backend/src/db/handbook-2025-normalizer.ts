export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface RawCourseRecord {
  academic_year?: unknown;
  uni_code?: unknown;
  university?: unknown;
  course_name?: unknown;
  faculty?: unknown;
  duration?: unknown;
  medium?: unknown;
  intake?: unknown;
  campus?: unknown;
}

export interface NormalizedCourseRecord {
  course_id: string;
  academic_year: string;
  uni_code: string;
  university: string;
  course_name: string;
  faculty: string | null;
  duration: string | null;
  medium: string | string[] | null;
  intake: number | null;
  campus: string | null;
}

export interface RawEligibilityRule {
  course_name?: unknown;
  eligible_streams?: unknown;
  required_subjects?: unknown;
  minimum_grades?: unknown;
  special_requirements?: unknown;
}

export interface ExpandedEligibilityRule {
  academic_year: string;
  uni_code: string;
  course_name: string;
  eligible_streams: string[];
  required_subjects: string[];
  minimum_grades: string[];
  special_requirements: string[];
}

export interface RawStagedProgrammeRow {
  academicYear?: unknown;
  university?: unknown;
  degreeName?: unknown;
  district?: unknown;
  minimumZScore?: unknown;
  zscoreMarker?: unknown;
  sourceSection?: unknown;
  verificationStatus?: unknown;
}

export interface ZScoreCutoffRecord {
  academic_year: string;
  uni_code: string;
  course_name: string;
  district: string;
  cutoff: number;
}

export interface QualityReport {
  sourceCourseCount: number;
  normalizedCourseCount: number;
  notAvailableReplacements: Record<string, number>;
  emptyRequiredFields: Array<{ index: number; field: string }>;
  duplicateUniCodes: Array<{ uni_code: string; count: number }>;
  duplicateCourseIdentities: Array<{ identity: string; count: number }>;
  invalidIntakes: Array<{ index: number; uni_code: string; intake: unknown }>;
  invalidStreams: Array<{ course_name: string; stream: unknown }>;
  missingEligibility: Array<{ academic_year: string; uni_code: string; course_name: string; university: string }>;
  unmatchedEligibilityRules: string[];
  eligibilityRuleSourceCount: number;
  expandedEligibilityCount: number;
  distinctEligibilityStreams: string[];
  zscoreSourceRows: number;
  zscoreOutputRows: number;
  zscoreRowsWithoutUniqueCourseIdentity: Array<{
    academic_year: string;
    university: string;
    course_name: string;
    district: string | null;
    reason: "missing_match" | "ambiguous_match";
  }>;
  zscoreRowsWithNonNumericCutoff: Array<{
    academic_year: string;
    university: string;
    course_name: string;
    district: string | null;
    marker: string | null;
  }>;
  zscoreRowsSkippedForReview: Array<{
    academic_year: string;
    university: string;
    course_name: string;
    district: string | null;
  }>;
}

export function isNotAvailable(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "not available";
}

function cleanRequiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value: unknown): string | null {
  if (value == null || isNotAvailable(value)) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function splitMedium(value: string): string[] {
  return value
    .replace(/\s+Medium\b/gi, "")
    .split(/\s*\/\s*|\s*,\s*|\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeMedium(value: unknown): string | string[] | null {
  const cleaned = cleanOptionalString(value);
  if (!cleaned) return null;

  const parts = Array.from(new Set(splitMedium(cleaned)));
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return parts;
}

export function normalizeIntake(value: unknown): number | null {
  if (value == null || isNotAvailable(value)) return null;
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function normalizeCourseRecord(raw: RawCourseRecord): NormalizedCourseRecord {
  const academicYear = cleanRequiredString(raw.academic_year);
  const uniCode = cleanRequiredString(raw.uni_code);
  const university = cleanRequiredString(raw.university);
  const courseName = cleanRequiredString(raw.course_name);

  return {
    course_id: `${academicYear}:${uniCode}`,
    academic_year: academicYear,
    uni_code: uniCode,
    university,
    course_name: courseName,
    faculty: cleanOptionalString(raw.faculty),
    duration: cleanOptionalString(raw.duration),
    medium: normalizeMedium(raw.medium),
    intake: normalizeIntake(raw.intake),
    campus: cleanOptionalString(raw.campus),
  };
}

export function deepReplaceNotAvailable(value: unknown): JsonValue {
  if (value == null || isNotAvailable(value)) return null;
  if (Array.isArray(value)) return value.map((item) => deepReplaceNotAvailable(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepReplaceNotAvailable(item)]),
    ) as { [key: string]: JsonValue };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function toStringArray(value: unknown): string[] {
  if (value == null || isNotAvailable(value)) return [];
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && !isNotAvailable(item));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
}

function ruleCourseName(rule: RawEligibilityRule): string {
  return cleanRequiredString(rule.course_name);
}

function reportInvalidEligibilityStreams(rule: RawEligibilityRule, report: QualityReport) {
  const courseName = ruleCourseName(rule);
  const value = rule.eligible_streams;
  if (value == null || isNotAvailable(value)) return;

  const values = Array.isArray(value) ? value : [value];
  for (const stream of values) {
    if (typeof stream !== "string" || stream.trim().length === 0 || isNotAvailable(stream)) {
      report.invalidStreams.push({ course_name: courseName, stream });
    }
  }
}

export function expandEligibilityRules(
  courses: NormalizedCourseRecord[],
  rules: RawEligibilityRule[],
  report: QualityReport,
): ExpandedEligibilityRule[] {
  const rulesByCourseName = new Map<string, RawEligibilityRule>();
  for (const rule of rules) {
    const courseName = ruleCourseName(rule);
    if (courseName) rulesByCourseName.set(courseName, rule);
    reportInvalidEligibilityStreams(rule, report);
  }

  const output: ExpandedEligibilityRule[] = [];
  for (const course of courses) {
    const rule = rulesByCourseName.get(course.course_name);
    if (!rule) {
      report.missingEligibility.push({
        academic_year: course.academic_year,
        uni_code: course.uni_code,
        course_name: course.course_name,
        university: course.university,
      });
      continue;
    }

    output.push({
      academic_year: course.academic_year,
      uni_code: course.uni_code,
      course_name: course.course_name,
      eligible_streams: toStringArray(rule.eligible_streams),
      required_subjects: toStringArray(rule.required_subjects),
      minimum_grades: toStringArray(rule.minimum_grades),
      special_requirements: toStringArray(rule.special_requirements),
    });
  }

  const courseNames = new Set(courses.map((course) => course.course_name));
  report.unmatchedEligibilityRules = rules
    .map((rule) => ruleCourseName(rule))
    .filter((courseName) => courseName && !courseNames.has(courseName))
    .sort();
  report.expandedEligibilityCount = output.length;
  report.distinctEligibilityStreams = Array.from(
    new Set(output.flatMap((rule) => rule.eligible_streams)),
  ).sort();

  return output;
}

function courseMatchKey(university: string, courseName: string) {
  return `${university.trim()}\u0000${courseName.trim()}`;
}

function isNumericCutoff(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export interface Section9AliasRule {
  uni: RegExp;
  deg?: RegExp;
  targetUni?: string;
  targetDeg?: string;
}

export const SECTION9_COURSE_ALIASES: Section9AliasRule[] = [
  { uni: /moratuwa/i, deg: /engineering\s*\(tm\)/i, targetDeg: "Engineering (TM) - Textile & Apparel Engineering" },
  { uni: /moratuwa/i, deg: /engineering\s*\(em\)/i, targetDeg: "Engineering (EM) - Earth Resources Engineering" },
  { uni: /sabaragamuwa/i, deg: /applied sciences\s*\(bio/i, targetDeg: "Applied Sciences (Biological Science)" },
  { uni: /rajarata/i, deg: /applied sciences\s*\(bio/i, targetDeg: "Applied Sciences (Biological Science)" },
  { uni: /sabaragamuwa/i, deg: /applied sciences\s*\(phy/i, targetDeg: "Applied Sciences (Physical Science)" },
  { uni: /rajarata/i, deg: /applied sciences\s*\(phy/i, targetDeg: "Applied Sciences (Physical Science)" },
  { uni: /wayamba/i, deg: /applied sciences\s*\(phy/i, targetDeg: "Applied Sciences (Physical Science)" },
  { uni: /vavuniya/i, deg: /applied sciences\s*\(phy/i, targetDeg: "Applied Sciences (Physical Science)" },
  { uni: /trincomalee/i, deg: /applied sciences\s*\(phy/i, targetDeg: "Applied Sciences (Physical Science)" },
  { uni: /sabaragamuwa/i, deg: /data science/i, targetDeg: "Data Science" },
  { uni: /sabaragamuwa/i, deg: /information systems/i, targetDeg: "Information Systems" },
  { uni: /sabaragamuwa/i, deg: /sports science/i, targetDeg: "Sports Science & Management" },
  { uni: /sabaragamuwa/i, deg: /translation studies/i, targetDeg: "Translation Studies" },
  { uni: /sabaragamuwa/i, deg: /arts\s*\(sab\)/i, targetDeg: "Arts (SAB)" },
  { uni: /sabaragamuwa/i, deg: /food business management/i, targetDeg: "Food Business Management" },
  { uni: /sri jayewardenepura/i, deg: /real estate/i, targetDeg: "Real Estate Management and Valuation" },
  { uni: /kelaniya/i, deg: /sports science/i, targetDeg: "Sports Science" },
  { uni: /kelaniya/i, deg: /peace & conflict/i, targetDeg: "Peace and Conflict Resolution" },
  { uni: /kelaniya/i, deg: /technology\s*\(mit\)/i, targetDeg: "Management and Information Technology (MIT)" },
  { uni: /uva wellassa/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /uva wellassa/i, deg: /engineering technology/i, targetDeg: "Engineering Technology (ET)" },
  { uni: /colombo/i, deg: /physiotherapy/i, targetDeg: "Physiotherapy" },
  { uni: /colombo/i, deg: /biochemistry & molecular/i, targetDeg: "Biochemistry & Molecular Biology" },
  { uni: /colombo/i, deg: /ayurveda/i, targetDeg: "Ayurveda Medicine and Surgery" },
  { uni: /colombo/i, deg: /unani/i, targetDeg: "Unani Medicine and Surgery" },
  { uni: /sri palee|sripalee/i, deg: /performing arts/i, targetUni: "Sripalee Campus, University of Colombo", targetDeg: "Arts (SP) - Performing Arts" },
  { uni: /sri palee|sripalee/i, deg: /mass media/i, targetUni: "Sripalee Campus, University of Colombo", targetDeg: "Arts (SP) - Mass Media" },
  { uni: /peradeniya/i, deg: /radiography/i, targetDeg: "Radiography" },
  { uni: /peradeniya/i, deg: /geographical information/i, targetDeg: "Geographical Information Science" },
  { uni: /jaffna/i, deg: /siddha/i, targetDeg: "Siddha Medicine and Surgery" },
  { uni: /trincomalee/i, deg: /siddha/i, targetDeg: "Siddha Medicine and Surgery" },
  { uni: /vavuniya/i, deg: /project management/i, targetDeg: "Project Management" },
  { uni: /vavuniya/i, deg: /banking & insurance/i, targetDeg: "Banking and Insurance" },
  { uni: /visual & performing/i, deg: /visual arts/i, targetDeg: "Visual Arts" },
  { uni: /jaffna/i, deg: /pharmacy/i, targetDeg: "Pharmacy" },
  { uni: /vavuniya/i, deg: /management studies\s*\(tv\)/i, targetDeg: "Management Studies (TV)" },
  { uni: /trincomalee/i, deg: /management studies\s*\(tv\)/i, targetDeg: "Management Studies (TV)" },
  { uni: /jayewardenepura/i, deg: /social work/i, targetUni: "University of Sri Jayewardenepura", targetDeg: "Social Work" },
  { uni: /ruhuna/i, deg: /financial mathematics/i, targetUni: "University of Ruhuna", targetDeg: "Financial Mathematics and Industrial Statistics" },
  { uni: /colombo/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /sri jayewardenepura/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /kelaniya/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /ruhuna/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /eastern university/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /south eastern/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /rajarata/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /vavuniya/i, deg: /information communication/i, targetDeg: "Information Communication Technology" },
  { uni: /sri jayewardenepura/i, deg: /creative music/i, targetDeg: "Creative Music Technology and Production" },
  { uni: /vipulananda/i, targetUni: "Swamy Vipulananda Institute of Aesthetic Studies, Eastern University, Sri Lanka" },
];

export function buildZScoreCutoffs(
  courses: NormalizedCourseRecord[],
  stagedRows: RawStagedProgrammeRow[],
  report: QualityReport,
): ZScoreCutoffRecord[] {
  const coursesByExactKey = new Map<string, NormalizedCourseRecord[]>();
  for (const course of courses) {
    const key = courseMatchKey(course.university, course.course_name);
    coursesByExactKey.set(key, [...(coursesByExactKey.get(key) ?? []), course]);
  }

  const output: ZScoreCutoffRecord[] = [];
  const seenCutoffs = new Set<string>();
  for (const row of stagedRows) {
    if (row.sourceSection !== "9") continue;

    const academicYear = cleanRequiredString(row.academicYear);
    const university = cleanRequiredString(row.university);
    const courseName = cleanRequiredString(row.degreeName);
    const district = cleanOptionalString(row.district);

    let resolvedUni = university;
    let resolvedCourseName = courseName;
    for (const alias of SECTION9_COURSE_ALIASES) {
      if (alias.uni.test(university) && (!alias.deg || alias.deg.test(courseName))) {
        if (alias.targetUni) resolvedUni = alias.targetUni;
        if (alias.targetDeg) resolvedCourseName = alias.targetDeg;
        break;
      }
    }

    const key = courseMatchKey(resolvedUni, resolvedCourseName);
    const matches = coursesByExactKey.get(key) ?? [];

    const wasRemapped = resolvedUni !== university || resolvedCourseName !== courseName;
    if (row.verificationStatus === "needs_review" && !wasRemapped) {
      report.zscoreRowsSkippedForReview.push({
        academic_year: academicYear,
        university,
        course_name: courseName,
        district,
      });
      continue;
    }

    if (matches.length !== 1) {
      report.zscoreRowsWithoutUniqueCourseIdentity.push({
        academic_year: academicYear,
        university,
        course_name: courseName,
        district,
        reason: matches.length === 0 ? "missing_match" : "ambiguous_match",
      });
      continue;
    }

    if (!isNumericCutoff(row.minimumZScore)) {
      report.zscoreRowsWithNonNumericCutoff.push({
        academic_year: academicYear,
        university,
        course_name: courseName,
        district,
        marker: cleanOptionalString(row.zscoreMarker),
      });
      continue;
    }

    if (!district) {
      report.zscoreRowsWithoutUniqueCourseIdentity.push({
        academic_year: academicYear,
        university,
        course_name: courseName,
        district,
        reason: "missing_match",
      });
      continue;
    }

    const cutoffKey = `${academicYear}\u0000${matches[0].uni_code}\u0000${district}`;
    if (seenCutoffs.has(cutoffKey)) continue;
    seenCutoffs.add(cutoffKey);

    output.push({
      academic_year: academicYear,
      uni_code: matches[0].uni_code,
      course_name: matches[0].course_name,
      district,
      cutoff: row.minimumZScore,
    });
  }

  report.zscoreSourceRows = stagedRows.filter((row) => row.sourceSection === "9").length;
  report.zscoreOutputRows = output.length;
  return output;
}

export function createEmptyQualityReport(sourceCourseCount: number, eligibilityRuleSourceCount: number): QualityReport {
  return {
    sourceCourseCount,
    normalizedCourseCount: 0,
    notAvailableReplacements: {},
    emptyRequiredFields: [],
    duplicateUniCodes: [],
    duplicateCourseIdentities: [],
    invalidIntakes: [],
    invalidStreams: [],
    missingEligibility: [],
    unmatchedEligibilityRules: [],
    eligibilityRuleSourceCount,
    expandedEligibilityCount: 0,
    distinctEligibilityStreams: [],
    zscoreSourceRows: 0,
    zscoreOutputRows: 0,
    zscoreRowsWithoutUniqueCourseIdentity: [],
    zscoreRowsWithNonNumericCutoff: [],
    zscoreRowsSkippedForReview: [],
  };
}

export function validateCourses(rawCourses: RawCourseRecord[], normalizedCourses: NormalizedCourseRecord[], report: QualityReport) {
  const optionalFields = ["faculty", "duration", "medium", "campus"] as const;
  for (const field of optionalFields) report.notAvailableReplacements[field] = 0;

  rawCourses.forEach((course, index) => {
    for (const field of ["academic_year", "uni_code", "university", "course_name"] as const) {
      if (!cleanRequiredString(course[field])) report.emptyRequiredFields.push({ index, field });
    }
    for (const field of optionalFields) {
      if (isNotAvailable(course[field])) report.notAvailableReplacements[field]++;
    }
    if (course.intake != null && !isNotAvailable(course.intake) && normalizeIntake(course.intake) == null) {
      report.invalidIntakes.push({ index, uni_code: cleanRequiredString(course.uni_code), intake: course.intake });
    }
  });

  const uniCodeCounts = new Map<string, number>();
  const identityCounts = new Map<string, number>();
  for (const course of normalizedCourses) {
    uniCodeCounts.set(course.uni_code, (uniCodeCounts.get(course.uni_code) ?? 0) + 1);
    identityCounts.set(course.course_id, (identityCounts.get(course.course_id) ?? 0) + 1);
  }

  report.duplicateUniCodes = Array.from(uniCodeCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([uni_code, count]) => ({ uni_code, count }));
  report.duplicateCourseIdentities = Array.from(identityCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([identity, count]) => ({ identity, count }));
  report.normalizedCourseCount = normalizedCourses.length;
}

function markdownList(items: string[], emptyText: string) {
  if (items.length === 0) return `- ${emptyText}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderQualityReport(report: QualityReport): string {
  const missingEligibility = report.missingEligibility.map(
    (item) => `${item.uni_code} | ${item.university} | ${item.course_name}`,
  );
  const unmatchedCutoffs = report.zscoreRowsWithoutUniqueCourseIdentity.slice(0, 200).map(
    (item) => `${item.academic_year} | ${item.university} | ${item.course_name} | ${item.district ?? "null"} | ${item.reason}`,
  );
  const markerCutoffs = report.zscoreRowsWithNonNumericCutoff.slice(0, 200).map(
    (item) => `${item.academic_year} | ${item.university} | ${item.course_name} | ${item.district ?? "null"} | ${item.marker ?? "null"}`,
  );
  const reviewCutoffs = report.zscoreRowsSkippedForReview.slice(0, 200).map(
    (item) => `${item.academic_year} | ${item.university} | ${item.course_name} | ${item.district ?? "null"}`,
  );

  return [
    "# Handbook 2025 Data Quality Report",
    "",
    "## Counts",
    `- Source course rows: ${report.sourceCourseCount}`,
    `- Normalized course rows: ${report.normalizedCourseCount}`,
    `- Source eligibility rule groups: ${report.eligibilityRuleSourceCount}`,
    `- Expanded eligibility rows: ${report.expandedEligibilityCount}`,
    `- Source Section 9 cutoff rows: ${report.zscoreSourceRows}`,
    `- Normalized numeric cutoff rows: ${report.zscoreOutputRows}`,
    "",
    "## Not Available Replacements",
    markdownList(
      Object.entries(report.notAvailableReplacements).map(([field, count]) => `${field}: ${count}`),
      "No replacements.",
    ),
    "",
    "## Required Field Issues",
    markdownList(
      report.emptyRequiredFields.map((item) => `row ${item.index}: empty ${item.field}`),
      "No empty required fields.",
    ),
    "",
    "## Duplicate Identity Issues",
    markdownList(
      [
        ...report.duplicateUniCodes.map((item) => `duplicate uni_code ${item.uni_code}: ${item.count}`),
        ...report.duplicateCourseIdentities.map((item) => `duplicate identity ${item.identity}: ${item.count}`),
      ],
      "No duplicate uni_code or academic_year + uni_code identities.",
    ),
    "",
    "## Intake Issues",
    markdownList(
      report.invalidIntakes.map((item) => `row ${item.index} (${item.uni_code}): ${String(item.intake)}`),
      "No invalid intake values.",
    ),
    "",
    "## Stream Mapping",
    `- Distinct handbook eligibility streams: ${report.distinctEligibilityStreams.join(", ") || "none"}`,
    markdownList(
      report.invalidStreams.map((item) => `${item.course_name}: ${String(item.stream)}`),
      "No invalid stream values in matched eligibility rules.",
    ),
    "",
    "## Missing Eligibility",
    markdownList(missingEligibility, "No courses missing exact eligibility mapping."),
    "",
    "## Eligibility Rules Not Used",
    markdownList(report.unmatchedEligibilityRules, "All eligibility rule groups matched at least one course."),
    "",
    "## Cutoff Mapping Issues",
    `- Rows without unique course identity: ${report.zscoreRowsWithoutUniqueCourseIdentity.length}`,
    `- Rows with non-numeric official markers: ${report.zscoreRowsWithNonNumericCutoff.length}`,
    `- Rows skipped because extraction requires review: ${report.zscoreRowsSkippedForReview.length}`,
    "",
    "### First 200 Rows Without Unique Course Identity",
    markdownList(unmatchedCutoffs, "No unmatched or ambiguous cutoff rows."),
    "",
    "### First 200 Non-Numeric Cutoff Markers",
    markdownList(markerCutoffs, "No non-numeric cutoff markers."),
    "",
    "### First 200 Cutoff Rows Requiring Review",
    markdownList(reviewCutoffs, "No cutoff rows require review."),
    "",
  ].join("\n");
}
