import { describe, expect, it } from "vitest";
import { buildSection9RemapPlan, type Section9Candidate, type Section9RemapRow } from "./section9-remap-report";

const candidate = (
  degreeName: string,
  overrides: Partial<Section9Candidate> = {},
): Section9Candidate => ({
  programmeId: 1,
  universityId: 1,
  universityName: "University of Moratuwa",
  academicYear: "2024/25",
  degreeName,
  ...overrides,
});

const row = (
  rawDegreeName: string,
  overrides: Partial<Section9RemapRow> = {},
): Section9RemapRow => ({
  academicYear: "2024/25",
  rawUniversityName: "University of Moratuwa",
  rawDegreeName,
  minimumZScore: 1.2345,
  ...overrides,
});

describe("buildSection9RemapPlan", () => {
  it("creates new suggested mappings only for unique high-confidence rows", () => {
    const report = buildSection9RemapPlan({
      rows: [row("Information Technology (IT)")],
      candidates: [candidate("B.Sc. (Hons) in Information Technology")],
      existingSuggestedAliases: [],
    });

    expect(report.uniqueNewSuggestions).toHaveLength(1);
    expect(report.counters.high_confidence.total).toBe(1);
    expect(report.remainingUnmappedCount).toBe(0);
  });

  it("keeps existing suggestions out of new insert candidates", () => {
    const report = buildSection9RemapPlan({
      rows: [row("Information Technology (IT)")],
      candidates: [candidate("B.Sc. (Hons) in Information Technology")],
      existingSuggestedAliases: [{
        programmeId: 1,
        aliasName: "Information Technology (IT)",
        academicYear: "2024/25",
        source: "phase_3_5_section9_dry_run",
      }],
    });

    expect(report.uniqueNewSuggestions).toHaveLength(0);
    expect(report.existingHighConfidenceSuggestions).toHaveLength(1);
  });

  it("reports medium-confidence matches without suggesting aliases", () => {
    const report = buildSection9RemapPlan({
      rows: [row("Technology Management")],
      candidates: [candidate("Food Production & Technology Management")],
      existingSuggestedAliases: [],
    });

    expect(report.uniqueNewSuggestions).toHaveLength(0);
    expect(report.mediumReviewCandidates).toHaveLength(1);
    expect(report.counters.medium_confidence.total).toBe(1);
  });

  it("does not match across different universities", () => {
    const report = buildSection9RemapPlan({
      rows: [row("Information Technology (IT)", { rawUniversityName: "University of Colombo" })],
      candidates: [candidate("B.Sc. (Hons) in Information Technology")],
      existingSuggestedAliases: [],
    });

    expect(report.uniqueNewSuggestions).toHaveLength(0);
    expect(report.counters.university_name_mismatch.total).toBe(1);
    expect(report.topUniversityMismatches[0]).toMatchObject({ name: "University of Colombo", count: 1 });
  });

  it("reports NQC and duplicate candidates without suggestions", () => {
    const report = buildSection9RemapPlan({
      rows: [
        row("Information Technology (IT)", { minimumZScore: null }),
        row("Business Information Systems"),
      ],
      candidates: [
        candidate("Business Information Systems (Honours) (BIS)", { programmeId: 2 }),
        candidate("B.Sc. (Hons) in Business Information Systems", { programmeId: 3 }),
      ],
      existingSuggestedAliases: [],
    });

    expect(report.uniqueNewSuggestions).toHaveLength(0);
    expect(report.counters.nqc_non_numeric.total).toBe(1);
    expect(report.counters.duplicate_alias_candidate.total).toBe(1);
    expect(report.duplicateAliasCandidates).toHaveLength(1);
  });
});
