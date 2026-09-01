import "../load-env";
import { pool } from "./client";

const SOURCE_HANDBOOK_YEAR = "2025/2026";

async function count(query: string, params: unknown[]) {
  const result = await pool.query(query, params);
  return Number(result.rows[0]?.count ?? 0);
}

async function main() {
  const checks = {
    courses: await count(
      "select count(*) from official_handbook_courses where academic_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
    missingRequired: await count(
      `
        select count(*) from official_handbook_courses
        where academic_year = $1
          and (uni_code = '' or university = '' or course_name = '' or course_id = '')
      `,
      [SOURCE_HANDBOOK_YEAR],
    ),
    duplicateIdentity: await count(
      `
        select count(*) from (
          select academic_year, uni_code
          from official_handbook_courses
          where academic_year = $1
          group by academic_year, uni_code
          having count(*) > 1
        ) duplicates
      `,
      [SOURCE_HANDBOOK_YEAR],
    ),
    notAvailableCourses: await count(
      `
        select count(*) from official_handbook_courses
        where academic_year = $1
          and (
            faculty = 'Not Available'
            or duration = 'Not Available'
            or campus = 'Not Available'
            or medium::text like '%Not Available%'
          )
      `,
      [SOURCE_HANDBOOK_YEAR],
    ),
    eligibility: await count(
      "select count(*) from official_handbook_eligibility_rules where academic_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
    zscore: await count(
      "select count(*) from official_handbook_zscore_cutoffs where source_handbook_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
    dataQualityReports: await count(
      "select count(*) from official_handbook_data_quality_reports where academic_year = $1",
      [SOURCE_HANDBOOK_YEAR],
    ),
  };

  console.log(JSON.stringify(checks, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
