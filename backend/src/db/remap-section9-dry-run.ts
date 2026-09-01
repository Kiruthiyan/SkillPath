import "../load-env";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "./client";
import {
  admissionCutoffsTable,
  courseAvailabilityTable,
  degreeProgrammesTable,
  extractedProgrammeRowsTable,
  handbookEditionsTable,
  programmeAliasesTable,
  universitiesTable,
} from "./schema/index";
import {
  type ProgrammeMatchReason,
} from "./programme-canonical-match";
import {
  toSuggestedProgrammeAlias,
} from "./section9-remap-rules";
import {
  buildSection9RemapPlan,
  section9SuggestionKey,
  type ExistingSuggestedAlias,
  type Section9AliasSuggestion,
  type Section9Candidate,
} from "./section9-remap-report";

const TARGET_YEARS = ["2022/23", "2023/24", "2024/25"] as const;
const SUGGESTION_SOURCE = "phase_3_6_section9_dry_run";

async function previousMappedCutoffCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(extractedProgrammeRowsTable)
    .where(
      and(
        inArray(extractedProgrammeRowsTable.academicYear, [...TARGET_YEARS]),
        eq(extractedProgrammeRowsTable.sourceSection, "9"),
        eq(extractedProgrammeRowsTable.status, "approved"),
        eq(extractedProgrammeRowsTable.verificationStatus, "clean"),
      ),
    );
  return row?.count ?? 0;
}

async function verifiedCutoffCountAfterDryRun() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(admissionCutoffsTable)
    .innerJoin(handbookEditionsTable, eq(admissionCutoffsTable.editionId, handbookEditionsTable.id))
    .where(
      and(
        inArray(handbookEditionsTable.academicYear, [...TARGET_YEARS]),
        inArray(admissionCutoffsTable.verifiedStatus, ["verified", "legacy_verified"]),
      ),
    );
  return row?.count ?? 0;
}

async function loadCandidates(): Promise<Section9Candidate[]> {
  const rows = await db
    .select({
      programmeId: degreeProgrammesTable.id,
      universityId: universitiesTable.id,
      universityName: universitiesTable.name,
      academicYear: courseAvailabilityTable.academicYear,
      degreeName: degreeProgrammesTable.degreeName,
    })
    .from(courseAvailabilityTable)
    .innerJoin(degreeProgrammesTable, eq(courseAvailabilityTable.degreeProgrammeId, degreeProgrammesTable.id))
    .innerJoin(universitiesTable, eq(degreeProgrammesTable.universityId, universitiesTable.id))
    .where(
      inArray(courseAvailabilityTable.academicYear, [...TARGET_YEARS]),
    );

  return rows;
}

async function loadPendingCleanSection9Rows() {
  return db
    .select({
      id: extractedProgrammeRowsTable.id,
      academicYear: extractedProgrammeRowsTable.academicYear,
      rawUniversityName: extractedProgrammeRowsTable.rawUniversityName,
      rawDegreeName: extractedProgrammeRowsTable.rawDegreeName,
      minimumZScore: extractedProgrammeRowsTable.minimumZScore,
      zscoreMarker: extractedProgrammeRowsTable.zscoreMarker,
    })
    .from(extractedProgrammeRowsTable)
    .where(
      and(
        inArray(extractedProgrammeRowsTable.academicYear, [...TARGET_YEARS]),
        eq(extractedProgrammeRowsTable.sourceSection, "9"),
        eq(extractedProgrammeRowsTable.status, "pending"),
        eq(extractedProgrammeRowsTable.verificationStatus, "clean"),
      ),
    )
    .orderBy(asc(extractedProgrammeRowsTable.academicYear), asc(extractedProgrammeRowsTable.id));
}

async function loadExistingSuggestedAliases(): Promise<ExistingSuggestedAlias[]> {
  return db
    .select({
      programmeId: programmeAliasesTable.programmeId,
      aliasName: programmeAliasesTable.aliasName,
      academicYear: programmeAliasesTable.academicYear,
      source: programmeAliasesTable.source,
    })
    .from(programmeAliasesTable)
    .where(
      and(
        inArray(programmeAliasesTable.academicYear, [...TARGET_YEARS]),
        eq(programmeAliasesTable.status, "suggested"),
      ),
    );
}

async function insertSuggestions(
  suggestions: Section9AliasSuggestion[],
) {
  if (suggestions.length === 0) return 0;

  const deduped = Array.from(
    new Map(
      suggestions.map((suggestion) => [
        section9SuggestionKey(suggestion.programmeId, suggestion.aliasName, suggestion.year),
        suggestion,
      ]),
    ).values(),
  );

  let inserted = 0;
  for (let index = 0; index < deduped.length; index += 500) {
    const batch = deduped.slice(index, index + 500);
    const insertedRows = await db
      .insert(programmeAliasesTable)
      .values(
        batch.map((suggestion) =>
          toSuggestedProgrammeAlias({
            programmeId: suggestion.programmeId,
            aliasName: suggestion.aliasName,
            academicYear: suggestion.year,
            source: SUGGESTION_SOURCE,
            confidence: suggestion.confidence,
            matchReason: suggestion.matchReason,
          }),
        ),
      )
      .onConflictDoNothing({
        target: [
          programmeAliasesTable.programmeId,
          programmeAliasesTable.aliasName,
          programmeAliasesTable.academicYear,
          programmeAliasesTable.source,
        ],
      })
      .returning({ id: programmeAliasesTable.id });
    inserted += insertedRows.length;
  }

  return inserted;
}

async function main() {
  const previousMappedCutoffs = await previousMappedCutoffCount();
  const previousVerifiedCutoffRows = await verifiedCutoffCountAfterDryRun();
  const candidates = await loadCandidates();
  const rows = await loadPendingCleanSection9Rows();
  const existingSuggestedAliases = await loadExistingSuggestedAliases();
  const plan = buildSection9RemapPlan({ rows, candidates, existingSuggestedAliases });
  const insertedSuggestions = await insertSuggestions(plan.uniqueNewSuggestions);
  const verifiedCutoffRowsAfter = await verifiedCutoffCountAfterDryRun();

  console.log(JSON.stringify({
    previousMappedCount: previousMappedCutoffs,
    previousVerifiedCutoffRows,
    verifiedCutoffRowsAfter,
    verifiedCutoffDataModified: verifiedCutoffRowsAfter !== previousVerifiedCutoffRows,
    existingSuggestedMappings: {
      uniqueAliases: plan.existingSuggestedMappings,
      rowsCovered: plan.existingHighConfidenceSuggestions.length,
    },
    newSuggestedMappings: {
      insertedAliases: insertedSuggestions,
      uniqueAliases: plan.uniqueNewSuggestions.length,
      rowsCovered: plan.newHighConfidenceSuggestions.length,
      suggestions: plan.groupedNewHighConfidenceSuggestions.slice(0, 100),
    },
    newDryRunMappedCount: previousMappedCutoffs + plan.highConfidenceSuggestions.length,
    remainingUnmappedCount: plan.remainingUnmappedCount,
    topUnmatchedCourseNames: plan.topUnmatchedCourseNames,
    topUniversityMismatches: plan.topUniversityMismatches,
    confidenceBreakdown: plan.counters,
    mediumReviewCandidates: plan.mediumReviewCandidates.slice(0, 100),
    duplicateAliasCandidates: plan.duplicateAliasCandidates.slice(0, 100),
    universityAliasCandidates: plan.universityAliasCandidates,
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
