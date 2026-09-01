/**
 * Phase 5.5 read-only data audit. Prints findings only — makes no writes.
 * Run: tsx backend/src/db/scripts/data-audit.ts
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import {
  degreeProgrammesTable,
  universitiesTable,
  courseAvailabilityTable,
  coursesTable,
  admissionCutoffsTable,
  subjectRequirementsTable,
  admissionRulesTable,
  academicYearsTable,
  handbookEditionsTable,
} from "../schema/index";
import { UGC_STREAMS } from "../constants/districts";

async function main() {
  console.log("=== Phase 5.5 Data Audit ===\n");

  // 1. Programmes with blank/whitespace stream, or stream not in UGC_STREAMS
  const allProgrammes = await db
    .select({
      id: degreeProgrammesTable.id,
      degreeName: degreeProgrammesTable.degreeName,
      universityId: degreeProgrammesTable.universityId,
      stream: degreeProgrammesTable.stream,
    })
    .from(degreeProgrammesTable);

  const blankStream = allProgrammes.filter((p) => p.stream.trim().length === 0);
  const unknownStream = allProgrammes.filter(
    (p) => p.stream.trim().length > 0 && !UGC_STREAMS.includes(p.stream as (typeof UGC_STREAMS)[number]),
  );
  const streamCounts = new Map<string, number>();
  for (const p of allProgrammes) streamCounts.set(p.stream, (streamCounts.get(p.stream) ?? 0) + 1);

  console.log(`Total degree_programmes rows: ${allProgrammes.length}`);
  console.log(`Blank/whitespace stream: ${blankStream.length}`, blankStream.slice(0, 10).map((p) => p.id));
  console.log(`Stream not in UGC_STREAMS list (${UGC_STREAMS.join(", ")}):`, unknownStream.length);
  for (const p of unknownStream.slice(0, 20)) {
    console.log(`  id=${p.id} degreeName="${p.degreeName}" stream="${p.stream}"`);
  }
  console.log("Distinct stream values with counts:");
  for (const [stream, count] of [...streamCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${stream}": ${count}`);
  }

  // 2. Duplicate (universityId, degreeName) pairs
  const dupKey = new Map<string, number[]>();
  for (const p of allProgrammes) {
    const key = `${p.universityId}::${p.degreeName.trim().toLowerCase()}`;
    if (!dupKey.has(key)) dupKey.set(key, []);
    dupKey.get(key)!.push(p.id);
  }
  const duplicates = [...dupKey.entries()].filter(([, ids]) => ids.length > 1);
  console.log(`\nDuplicate (university_id, degree_name) mappings: ${duplicates.length}`);
  for (const [key, ids] of duplicates.slice(0, 20)) {
    console.log(`  ${key} -> programme ids: ${ids.join(",")}`);
  }

  // 3. Programmes without a resolvable university (leftJoin miss) — should be impossible given FK NOT NULL + restrict, confirm
  const orphanUniversity = await db
    .select({ id: degreeProgrammesTable.id, universityId: degreeProgrammesTable.universityId })
    .from(degreeProgrammesTable)
    .leftJoin(universitiesTable, eq(degreeProgrammesTable.universityId, universitiesTable.id))
    .where(isNull(universitiesTable.id));
  console.log(`\nProgrammes with unresolvable university_id (orphaned FK): ${orphanUniversity.length}`, orphanUniversity);

  // 4. course_availability rows whose academic_year has no matching academic_years or handbook_editions row
  const [availabilityYears, trackedYears, editionYears] = await Promise.all([
    db.selectDistinct({ academicYear: courseAvailabilityTable.academicYear }).from(courseAvailabilityTable),
    db.select({ academicYear: academicYearsTable.academicYear }).from(academicYearsTable),
    db.selectDistinct({ academicYear: handbookEditionsTable.academicYear }).from(handbookEditionsTable),
  ]);
  const knownYears = new Set([
    ...trackedYears.map((y) => y.academicYear),
    ...editionYears.map((y) => y.academicYear),
  ]);
  const unknownAvailabilityYears = availabilityYears.filter((y) => !knownYears.has(y.academicYear));
  console.log(
    `\ncourse_availability academic_year values with no matching academic_years/handbook_editions row: ${unknownAvailabilityYears.length}`,
    unknownAvailabilityYears,
  );

  // 5. admission_cutoffs / subject_requirements / admission_rules referencing missing programme ids (sanity check on FKs)
  const programmeIds = new Set(allProgrammes.map((p) => p.id));
  const [cutoffProgrammeIds, subjectProgrammeIds, ruleProgrammeIds] = await Promise.all([
    db.selectDistinct({ programmeId: admissionCutoffsTable.programmeId }).from(admissionCutoffsTable),
    db.selectDistinct({ programmeId: subjectRequirementsTable.programmeId }).from(subjectRequirementsTable),
    db.selectDistinct({ programmeId: admissionRulesTable.programmeId }).from(admissionRulesTable),
  ]);
  const danglingCutoffs = cutoffProgrammeIds.filter((r) => !programmeIds.has(r.programmeId));
  const danglingSubjects = subjectProgrammeIds.filter((r) => !programmeIds.has(r.programmeId));
  const danglingRules = ruleProgrammeIds.filter((r) => !programmeIds.has(r.programmeId));
  console.log(`\nDangling admission_cutoffs.programme_id: ${danglingCutoffs.length}`, danglingCutoffs);
  console.log(`Dangling subject_requirements.programme_id: ${danglingSubjects.length}`, danglingSubjects);
  console.log(`Dangling admission_rules.programme_id: ${danglingRules.length}`, danglingRules);

  // 6. Legacy `courses` table drift vs degree_programmes (stream/university mismatch where linked)
  const legacyCourses = await db
    .select({
      id: coursesTable.id,
      programmeId: coursesTable.programmeId,
      stream: coursesTable.stream,
      universityId: coursesTable.universityId,
    })
    .from(coursesTable)
    .where(sql`${coursesTable.programmeId} IS NOT NULL`);
  const programmeById = new Map(allProgrammes.map((p) => [p.id, p]));
  const drift = legacyCourses.filter((c) => {
    const p = c.programmeId != null ? programmeById.get(c.programmeId) : undefined;
    if (!p) return false;
    return p.stream !== c.stream || p.universityId !== c.universityId;
  });
  console.log(`\nLegacy 'courses' rows drifted from linked degree_programmes (stream/university mismatch): ${drift.length}`);
  for (const c of drift.slice(0, 20)) {
    const p = programmeById.get(c.programmeId!)!;
    console.log(
      `  courses.id=${c.id} programmeId=${c.programmeId} courses.stream="${c.stream}" vs programme.stream="${p.stream}" | courses.universityId=${c.universityId} vs programme.universityId=${p.universityId}`,
    );
  }

  // 7. course_availability duplicate (degreeProgrammeId, academicYear) beyond unique constraint - sanity check only
  const availabilityRows = await db
    .select({ degreeProgrammeId: courseAvailabilityTable.degreeProgrammeId, academicYear: courseAvailabilityTable.academicYear })
    .from(courseAvailabilityTable);
  const availKey = new Map<string, number>();
  for (const r of availabilityRows) {
    const key = `${r.degreeProgrammeId}::${r.academicYear}`;
    availKey.set(key, (availKey.get(key) ?? 0) + 1);
  }
  const availDupes = [...availKey.entries()].filter(([, count]) => count > 1);
  console.log(`\ncourse_availability duplicate (degree_programme_id, academic_year) rows (should be 0, unique constraint): ${availDupes.length}`, availDupes);

  console.log("\n=== Audit complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
