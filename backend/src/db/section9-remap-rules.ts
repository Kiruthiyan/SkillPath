import type { ProgrammeMatchResult, ProgrammeMatchReason } from "./programme-canonical-match";

export const SECTION9_ALIAS_SUGGESTION_STATUS = "suggested";

export function hasNumericSection9Cutoff(value: unknown) {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;
  return Number.isFinite(Number(trimmed));
}

export function canSuggestSection9Alias(
  minimumZScore: unknown,
  matchResult: ProgrammeMatchResult,
) {
  return hasNumericSection9Cutoff(minimumZScore) && matchResult.status === "high_confidence" && matchResult.suggestion != null;
}

export function toSuggestedProgrammeAlias(input: {
  programmeId: number;
  aliasName: string;
  academicYear: string;
  source: string;
  confidence: number;
  matchReason: ProgrammeMatchReason;
}) {
  return {
    programmeId: input.programmeId,
    aliasName: input.aliasName,
    academicYear: input.academicYear,
    source: input.source,
    status: SECTION9_ALIAS_SUGGESTION_STATUS,
    confidence: input.confidence,
    matchReason: input.matchReason,
  };
}
