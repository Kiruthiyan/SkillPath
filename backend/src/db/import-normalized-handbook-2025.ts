import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import "../load-env";
import { pool } from "./client";
import type { PoolClient } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(__dirname, "../../..");
const HANDBOOK_2025_DIR = join(WORKSPACE_ROOT, "HandBook", "2025");
const SOURCE_HANDBOOK_YEAR = "2025/2026";

interface UniversityFile {
  universities: Array<{
    university_code: string;
    university_name: string;
    institutes: unknown[];
  }>;
}

interface CourseFile {
  courses: Array<{
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
  }>;
}

interface EligibilityRule {
  academic_year: string;
  uni_code: string;
  course_name: string;
  eligible_streams: string[];
  required_subjects: string[];
  minimum_grades: string[];
  special_requirements: string[];
}

interface ZScoreCutoff {
  academic_year: string;
  uni_code: string;
  course_name: string;
  district: string;
  cutoff: number;
}

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(HANDBOOK_2025_DIR, fileName), "utf-8")) as T;
}

function required(value: string, field: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required ${field} in generated handbook data.`);
  }
  return value;
}

function jsonb(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

async function ensureTables(client: PoolClient) {
  await client.query(`
    create table if not exists official_handbook_universities (
      academic_year text not null,
      university_code text not null,
      university_name text not null,
      institutes jsonb not null default '[]'::jsonb,
      imported_at timestamp not null default now(),
      primary key (academic_year, university_code)
    )
  `);

  await client.query(`
    create table if not exists official_handbook_courses (
      academic_year text not null,
      uni_code text not null,
      course_id text not null,
      university text not null,
      course_name text not null,
      faculty text,
      duration text,
      medium jsonb,
      intake integer,
      campus text,
      imported_at timestamp not null default now(),
      primary key (academic_year, uni_code),
      unique (course_id)
    )
  `);

  await client.query(`
    create table if not exists official_handbook_eligibility_rules (
      academic_year text not null,
      uni_code text not null,
      course_name text not null,
      eligible_streams jsonb not null default '[]'::jsonb,
      required_subjects jsonb not null default '[]'::jsonb,
      minimum_grades jsonb not null default '[]'::jsonb,
      special_requirements jsonb not null default '[]'::jsonb,
      imported_at timestamp not null default now(),
      primary key (academic_year, uni_code)
    )
  `);

  await client.query(`
    create table if not exists official_handbook_zscore_cutoffs (
      source_handbook_year text not null,
      academic_year text not null,
      uni_code text not null,
      course_name text not null,
      district text not null,
      cutoff real not null,
      imported_at timestamp not null default now(),
      primary key (source_handbook_year, academic_year, uni_code, district)
    )
  `);

  await client.query(`
    create table if not exists official_handbook_data_quality_reports (
      academic_year text primary key,
      report_markdown text not null,
      imported_at timestamp not null default now()
    )
  `);
}

async function importUniversities(client: PoolClient, data: UniversityFile) {
  await client.query("delete from official_handbook_universities where academic_year = $1", [SOURCE_HANDBOOK_YEAR]);
  for (const university of data.universities) {
    await client.query(
      `
        insert into official_handbook_universities
          (academic_year, university_code, university_name, institutes, imported_at)
        values ($1, $2, $3, $4::jsonb, now())
      `,
      [
        SOURCE_HANDBOOK_YEAR,
        required(university.university_code, "university_code"),
        required(university.university_name, "university_name"),
        JSON.stringify(university.institutes ?? []),
      ],
    );
  }
}

async function importCourses(client: PoolClient, data: CourseFile) {
  const academicYears = Array.from(new Set(data.courses.map((course) => course.academic_year)));
  for (const academicYear of academicYears) {
    await client.query("delete from official_handbook_courses where academic_year = $1", [academicYear]);
  }

  for (const course of data.courses) {
    await client.query(
      `
        insert into official_handbook_courses
          (academic_year, uni_code, course_id, university, course_name, faculty, duration, medium, intake, campus, imported_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, now())
      `,
      [
        required(course.academic_year, "academic_year"),
        required(course.uni_code, "uni_code"),
        required(course.course_id, "course_id"),
        required(course.university, "university"),
        required(course.course_name, "course_name"),
        course.faculty,
        course.duration,
        jsonb(course.medium),
        course.intake,
        course.campus,
      ],
    );
  }
}

async function importEligibilityRules(client: PoolClient, rules: EligibilityRule[]) {
  const academicYears = Array.from(new Set(rules.map((rule) => rule.academic_year)));
  for (const academicYear of academicYears) {
    await client.query("delete from official_handbook_eligibility_rules where academic_year = $1", [academicYear]);
  }

  for (const rule of rules) {
    await client.query(
      `
        insert into official_handbook_eligibility_rules
          (academic_year, uni_code, course_name, eligible_streams, required_subjects, minimum_grades, special_requirements, imported_at)
        values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, now())
      `,
      [
        required(rule.academic_year, "academic_year"),
        required(rule.uni_code, "uni_code"),
        required(rule.course_name, "course_name"),
        JSON.stringify(rule.eligible_streams),
        JSON.stringify(rule.required_subjects),
        JSON.stringify(rule.minimum_grades),
        JSON.stringify(rule.special_requirements),
      ],
    );
  }
}

async function importZScoreCutoffs(client: PoolClient, cutoffs: ZScoreCutoff[]) {
  await client.query("delete from official_handbook_zscore_cutoffs where source_handbook_year = $1", [
    SOURCE_HANDBOOK_YEAR,
  ]);

  const chunkSize = 200;
  for (let i = 0; i < cutoffs.length; i += chunkSize) {
    const chunk = cutoffs.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    chunk.forEach((c, idx) => {
      const offset = idx * 6;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, now())`);
      values.push(
        SOURCE_HANDBOOK_YEAR,
        required(c.academic_year, "academic_year"),
        required(c.uni_code, "uni_code"),
        required(c.course_name, "course_name"),
        required(c.district, "district"),
        c.cutoff,
      );
    });

    await client.query(
      `
        insert into official_handbook_zscore_cutoffs
          (source_handbook_year, academic_year, uni_code, course_name, district, cutoff, imported_at)
        values ${placeholders.join(", ")}
        on conflict (source_handbook_year, academic_year, uni_code, district) do update set
          cutoff = excluded.cutoff,
          imported_at = now()
      `,
      values,
    );
  }
}

async function importQualityReport(client: PoolClient) {
  const report = readFileSync(join(HANDBOOK_2025_DIR, "data_quality_report.md"), "utf-8");
  await client.query(
    `
      insert into official_handbook_data_quality_reports
        (academic_year, report_markdown, imported_at)
      values ($1, $2, now())
      on conflict (academic_year) do update set
        report_markdown = excluded.report_markdown,
        imported_at = now()
    `,
    [SOURCE_HANDBOOK_YEAR, report],
  );
}

async function countRows(table: string, where = "", params: unknown[] = []) {
  const result = await pool.query(`select count(*)::int as count from ${table} ${where}`, params);
  return result.rows[0]?.count as number;
}

async function main() {
  const universities = readJson<UniversityFile>("universities_2025.json");
  const courses = readJson<CourseFile>("courses_2025.json");
  const eligibilityRules = readJson<EligibilityRule[]>("eligibility_rules_2025.json");
  const zscoreCutoffs = readJson<ZScoreCutoff[]>("zscore_cutoffs_2025.json");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await ensureTables(client);
    await importUniversities(client, universities);
    await importCourses(client, courses);
    await importEligibilityRules(client, eligibilityRules);
    await importZScoreCutoffs(client, zscoreCutoffs);
    await importQualityReport(client);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log(JSON.stringify({
    official_handbook_universities: await countRows(
      "official_handbook_universities",
      "where academic_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
    official_handbook_courses: await countRows(
      "official_handbook_courses",
      "where academic_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
    official_handbook_eligibility_rules: await countRows(
      "official_handbook_eligibility_rules",
      "where academic_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
    official_handbook_zscore_cutoffs: await countRows(
      "official_handbook_zscore_cutoffs",
      "where source_handbook_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
    official_handbook_data_quality_reports: await countRows(
      "official_handbook_data_quality_reports",
      "where academic_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
