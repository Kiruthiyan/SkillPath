import { describe, expect, it } from "vitest";
import type { ProgrammeMatchResult } from "./programme-canonical-match";
import {
  canSuggestSection9Alias,
  hasNumericSection9Cutoff,
  SECTION9_ALIAS_SUGGESTION_STATUS,
  toSuggestedProgrammeAlias,
} from "./section9-remap-rules";

const highConfidenceResult = {
  status: "high_confidence",
  suggestion: {
    programmeId: 1,
    aliasName: "Information Technology (IT)",
    matchedName: "B.Sc. (Hons) in Information Technology",
    confidence: 100,
    matchReason: "formatting_difference",
  },
  candidates: [],
  reason: "formatting_difference",
} satisfies ProgrammeMatchResult;

describe("section9 remap rules", () => {
  it("creates inactive suggested aliases for high-confidence rows", () => {
    expect(canSuggestSection9Alias("1.2345", highConfidenceResult)).toBe(true);

    expect(
      toSuggestedProgrammeAlias({
        programmeId: 1,
        aliasName: "Information Technology (IT)",
        academicYear: "2024/25",
        source: "phase_3_5_section9_dry_run",
        confidence: 100,
        matchReason: "formatting_difference",
      }),
    ).toMatchObject({
      status: SECTION9_ALIAS_SUGGESTION_STATUS,
      source: "phase_3_5_section9_dry_run",
      confidence: 100,
    });
  });

  it("does not suggest aliases for NQC or non-numeric cutoff rows", () => {
    expect(hasNumericSection9Cutoff(null)).toBe(false);
    expect(hasNumericSection9Cutoff("NQC")).toBe(false);
    expect(canSuggestSection9Alias(null, highConfidenceResult)).toBe(false);
    expect(canSuggestSection9Alias("NQC", highConfidenceResult)).toBe(false);
  });

  it("reports low-confidence and duplicate matches without suggestions", () => {
    const lowConfidence = {
      status: "low_confidence",
      suggestion: null,
      candidates: [],
      reason: "manual_review",
    } satisfies ProgrammeMatchResult;
    const duplicate = {
      status: "duplicate_alias_candidate",
      suggestion: null,
      candidates: [
        {
          programmeId: 1,
          aliasName: "Business Information Systems",
          matchedName: "Business Information Systems (Honours) (BIS)",
          confidence: 100,
          matchReason: "formatting_difference",
        },
        {
          programmeId: 2,
          aliasName: "Business Information Systems",
          matchedName: "B.Sc. (Hons) in Business Information Systems",
          confidence: 100,
          matchReason: "formatting_difference",
        },
      ],
      reason: "duplicate_alias_candidate",
    } satisfies ProgrammeMatchResult;

    expect(canSuggestSection9Alias("1.2345", lowConfidence)).toBe(false);
    expect(canSuggestSection9Alias("1.2345", duplicate)).toBe(false);
  });

  it("reports medium-confidence matches without suggestions", () => {
    const mediumConfidence = {
      status: "medium_confidence",
      suggestion: {
        programmeId: 1,
        aliasName: "Technology Management",
        matchedName: "Food Production & Technology Management",
        confidence: 88,
        matchReason: "stream_suffix_prefix_difference",
      },
      candidates: [],
      reason: "stream_suffix_prefix_difference",
    } satisfies ProgrammeMatchResult;

    expect(canSuggestSection9Alias("1.2345", mediumConfidence)).toBe(false);
  });
});
