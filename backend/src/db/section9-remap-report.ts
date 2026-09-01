import {
  classifyUniversityName,
  findHighConfidenceProgrammeMatch,
  type ProgrammeMatchCandidate,
  type ProgrammeMatchReason,
  type ProgrammeMatchResult,
  type ProgrammeMatchSuggestion,
} from "./programme-canonical-match";
import { canSuggestSection9Alias, hasNumericSection9Cutoff } from "./section9-remap-rules";

export type Section9RemapReason =
  | "high_confidence"
  | "medium_confidence"
  | "low_confidence"
  | "nqc_non_numeric"
  | "university_name_mismatch"
  | "course_name_mismatch"
  | "formatting_difference"
  | "stream_suffix_prefix_difference"
  | "duplicate_alias_candidate"
  | "manual_review";

export interface Section9RemapRow {
  academicYear: string | null;
  rawUniversityName: string;
  rawDegreeName: string;
  minimumZScore: unknown;
}

export interface Section9Candidate extends ProgrammeMatchCandidate {
  universityName: string;
}

export interface ExistingSuggestedAlias {
  programmeId: number;
  aliasName: string;
  academicYear: string | null;
  source: string;
}

export interface Section9AliasSuggestion {
  year: string;
  university: string;
  aliasName: string;
  programmeId: number;
  matchedName: string;
  confidence: number;
  matchReason: ProgrammeMatchReason;
}

export interface GroupedSection9AliasSuggestion extends Section9AliasSuggestion {
  rowsCovered: number;
}

interface RemapCounters {
  total: number;
  byYear: Record<string, number>;
}

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function counter() {
  return { total: 0, byYear: {} } satisfies RemapCounters;
}

function increment(counters: Record<Section9RemapReason, RemapCounters>, reason: Section9RemapReason, year: string) {
  counters[reason].total++;
  counters[reason].byYear[year] = (counters[reason].byYear[year] ?? 0) + 1;
}

export function section9SuggestionKey(programmeId: number, aliasName: string, academicYear: string) {
  return `${programmeId}:${academicYear}:${normalized(aliasName)}`;
}

export function emptySection9RemapCounters(): Record<Section9RemapReason, RemapCounters> {
  return {
    high_confidence: counter(),
    medium_confidence: counter(),
    low_confidence: counter(),
    nqc_non_numeric: counter(),
    university_name_mismatch: counter(),
    course_name_mismatch: counter(),
    formatting_difference: counter(),
    stream_suffix_prefix_difference: counter(),
    duplicate_alias_candidate: counter(),
    manual_review: counter(),
  };
}

function toAliasSuggestion(
  row: Section9RemapRow,
  suggestion: ProgrammeMatchSuggestion,
): Section9AliasSuggestion {
  return {
    year: row.academicYear ?? "",
    university: row.rawUniversityName,
    aliasName: row.rawDegreeName,
    programmeId: suggestion.programmeId,
    matchedName: suggestion.matchedName,
    confidence: suggestion.confidence,
    matchReason: suggestion.matchReason,
  };
}

function topCounts(values: string[], limit = 25) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function groupAliasSuggestions(suggestions: Section9AliasSuggestion[]): GroupedSection9AliasSuggestion[] {
  const grouped = new Map<string, GroupedSection9AliasSuggestion>();
  for (const suggestion of suggestions) {
    const key = section9SuggestionKey(suggestion.programmeId, suggestion.aliasName, suggestion.year);
    const existing = grouped.get(key);
    if (existing) {
      existing.rowsCovered++;
      continue;
    }
    grouped.set(key, { ...suggestion, rowsCovered: 1 });
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.rowsCovered - a.rowsCovered || a.year.localeCompare(b.year) || a.university.localeCompare(b.university));
}

function recordCandidate(
  counters: Record<Section9RemapReason, RemapCounters>,
  row: Section9RemapRow,
  result: ProgrammeMatchResult,
) {
  const year = row.academicYear ?? "";
  if (result.status === "duplicate_alias_candidate") {
    increment(counters, "duplicate_alias_candidate", year);
    return;
  }

  if (result.status === "medium_confidence") {
    increment(counters, "medium_confidence", year);
    increment(counters, result.reason, year);
    return;
  }

  increment(counters, "low_confidence", year);
  increment(counters, "course_name_mismatch", year);
}

export function buildSection9RemapPlan(input: {
  rows: Section9RemapRow[];
  candidates: Section9Candidate[];
  existingSuggestedAliases: ExistingSuggestedAlias[];
}) {
  const counters = emptySection9RemapCounters();
  const byUniversityYear = new Map<string, ProgrammeMatchCandidate[]>();
  const universityNames = new Set<string>();
  const existingKeys = new Set(
    input.existingSuggestedAliases.map((alias) =>
      section9SuggestionKey(alias.programmeId, alias.aliasName, alias.academicYear ?? ""),
    ),
  );
  const existingSuggestedMappings = input.existingSuggestedAliases.length;
  const highConfidenceSuggestions: Section9AliasSuggestion[] = [];
  const newHighConfidenceSuggestions: Section9AliasSuggestion[] = [];
  const existingHighConfidenceSuggestions: Section9AliasSuggestion[] = [];
  const mediumReviewCandidates: Section9AliasSuggestion[] = [];
  const duplicateAliasCandidates: Array<{
    year: string;
    university: string;
    aliasName: string;
    candidates: ProgrammeMatchSuggestion[];
  }> = [];
  const unmatchedCourseNames: string[] = [];
  const unmatchedUniversityNames: string[] = [];
  const universityAliasCandidates: Array<{
    rawUniversityName: string;
    suggestedUniversityName: string;
  }> = [];

  for (const candidate of input.candidates) {
    universityNames.add(candidate.universityName);
    const key = `${normalized(candidate.universityName)}:${candidate.academicYear}`;
    if (!byUniversityYear.has(key)) byUniversityYear.set(key, []);
    byUniversityYear.get(key)!.push(candidate);
  }

  for (const row of input.rows) {
    const year = row.academicYear ?? "";
    if (!hasNumericSection9Cutoff(row.minimumZScore)) {
      increment(counters, "nqc_non_numeric", year);
      continue;
    }

    const candidates = byUniversityYear.get(`${normalized(row.rawUniversityName)}:${year}`);
    if (!candidates || candidates.length === 0) {
      increment(counters, "university_name_mismatch", year);
      unmatchedUniversityNames.push(row.rawUniversityName);
      const universityMatch = classifyUniversityName(row.rawUniversityName, universityNames);
      if (universityMatch.status === "alias_candidate" && universityMatch.matchedName) {
        universityAliasCandidates.push({
          rawUniversityName: row.rawUniversityName,
          suggestedUniversityName: universityMatch.matchedName,
        });
      }
      continue;
    }

    const result = findHighConfidenceProgrammeMatch(row.rawDegreeName, candidates);
    if (canSuggestSection9Alias(row.minimumZScore, result) && result.suggestion) {
      const suggestion = toAliasSuggestion(row, result.suggestion);
      highConfidenceSuggestions.push(suggestion);
      increment(counters, "high_confidence", year);
      increment(counters, suggestion.matchReason, year);

      if (existingKeys.has(section9SuggestionKey(suggestion.programmeId, suggestion.aliasName, suggestion.year))) {
        existingHighConfidenceSuggestions.push(suggestion);
      } else {
        newHighConfidenceSuggestions.push(suggestion);
      }
      continue;
    }

    recordCandidate(counters, row, result);
    if (result.status === "medium_confidence" && result.suggestion) {
      mediumReviewCandidates.push(toAliasSuggestion(row, result.suggestion));
      continue;
    }

    if (result.status === "duplicate_alias_candidate") {
      duplicateAliasCandidates.push({
        year,
        university: row.rawUniversityName,
        aliasName: row.rawDegreeName,
        candidates: result.candidates,
      });
      continue;
    }

    unmatchedCourseNames.push(row.rawDegreeName);
  }

  const uniqueNewSuggestions = Array.from(
    new Map(
      newHighConfidenceSuggestions.map((suggestion) => [
        section9SuggestionKey(suggestion.programmeId, suggestion.aliasName, suggestion.year),
        suggestion,
      ]),
    ).values(),
  );

  const uniqueUniversityAliasCandidates = Array.from(
    new Map(
      universityAliasCandidates.map((candidate) => [
        `${normalized(candidate.rawUniversityName)}:${normalized(candidate.suggestedUniversityName)}`,
        candidate,
      ]),
    ).values(),
  );

  return {
    counters,
    highConfidenceSuggestions,
    newHighConfidenceSuggestions,
    existingHighConfidenceSuggestions,
    uniqueNewSuggestions,
    groupedHighConfidenceSuggestions: groupAliasSuggestions(highConfidenceSuggestions),
    groupedNewHighConfidenceSuggestions: groupAliasSuggestions(newHighConfidenceSuggestions),
    groupedExistingHighConfidenceSuggestions: groupAliasSuggestions(existingHighConfidenceSuggestions),
    existingSuggestedMappings,
    mediumReviewCandidates: groupAliasSuggestions(mediumReviewCandidates),
    duplicateAliasCandidates,
    topUnmatchedCourseNames: topCounts(unmatchedCourseNames),
    topUniversityMismatches: topCounts(unmatchedUniversityNames),
    universityAliasCandidates: uniqueUniversityAliasCandidates,
    remainingUnmappedCount: input.rows.length - highConfidenceSuggestions.length,
  };
}
