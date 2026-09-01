import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  buildZScoreCutoffs,
  createEmptyQualityReport,
  deepReplaceNotAvailable,
  expandEligibilityRules,
  normalizeCourseRecord,
  renderQualityReport,
  validateCourses,
  type RawCourseRecord,
  type RawEligibilityRule,
  type RawStagedProgrammeRow,
} from "./handbook-2025-normalizer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(__dirname, "../../..");
const HANDBOOK_2025_DIR = join(WORKSPACE_ROOT, "HandBook", "2025");
const STAGING_FILE = join(WORKSPACE_ROOT, "backend", "data", "handbooks", "staging", "2025_26_en.json");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function main() {
  const rawCoursesFile = readJson<{ courses: RawCourseRecord[] }>(join(HANDBOOK_2025_DIR, "courses.json"));
  const rawUniversitiesFile = readJson<unknown>(join(HANDBOOK_2025_DIR, "universities.json"));
  const rawEligibilityRules = readJson<RawEligibilityRule[]>(join(HANDBOOK_2025_DIR, "eligibility_rules.json"));
  const stagedRows = existsSync(STAGING_FILE)
    ? readJson<{ programmes: RawStagedProgrammeRow[] }>(STAGING_FILE).programmes
    : [];

  const rawCourses = rawCoursesFile.courses;
  const courses = rawCourses.map((course) => normalizeCourseRecord(course));
  const report = createEmptyQualityReport(rawCourses.length, rawEligibilityRules.length);
  validateCourses(rawCourses, courses, report);

  const universities = deepReplaceNotAvailable(rawUniversitiesFile);
  const eligibilityRules = expandEligibilityRules(courses, rawEligibilityRules, report);
  const zscoreCutoffs = buildZScoreCutoffs(courses, stagedRows, report);

  mkdirSync(HANDBOOK_2025_DIR, { recursive: true });
  writeJson(join(HANDBOOK_2025_DIR, "universities_2025.json"), universities);
  writeJson(join(HANDBOOK_2025_DIR, "courses_2025.json"), { courses });
  writeJson(join(HANDBOOK_2025_DIR, "eligibility_rules_2025.json"), eligibilityRules);
  writeJson(join(HANDBOOK_2025_DIR, "zscore_cutoffs_2025.json"), zscoreCutoffs);
  writeFileSync(join(HANDBOOK_2025_DIR, "data_quality_report.md"), renderQualityReport(report), "utf-8");

  console.log(`Generated ${courses.length} courses, ${eligibilityRules.length} eligibility rows, ${zscoreCutoffs.length} cutoff rows.`);
}

main();
