import { describe, expect, it } from "vitest";
import { chooseApplicableYearRows, groupApplicableYearRows } from "./eligibility-year-scope";

describe("chooseApplicableYearRows", () => {
  it("uses exact-year rules when eligibility changes between handbooks", () => {
    const rows = [
      { programmeId: 1, academicYear: "2025/26", description: "Old eligibility rule" },
      { programmeId: 1, academicYear: "2026/27", description: "Changed eligibility rule" },
      { programmeId: 1, academicYear: null, description: "Legacy fallback rule" },
    ];

    expect(chooseApplicableYearRows(rows, "2026/27")).toEqual([
      { programmeId: 1, academicYear: "2026/27", description: "Changed eligibility rule" },
    ]);
  });

  it("falls back only to legacy rows when a requested year has no scoped rows", () => {
    const rows = [
      { programmeId: 1, academicYear: "2025/26", subjectName: "Physics" },
      { programmeId: 1, academicYear: null, subjectName: "Combined Mathematics" },
    ];

    expect(chooseApplicableYearRows(rows, "2027/28")).toEqual([
      { programmeId: 1, academicYear: null, subjectName: "Combined Mathematics" },
    ]);
  });

  it("preserves old unscoped behaviour when no academic year is provided", () => {
    const rows = [
      { programmeId: 1, academicYear: "2025/26", subjectName: "Physics" },
      { programmeId: 1, academicYear: null, subjectName: "Combined Mathematics" },
    ];

    expect(chooseApplicableYearRows(rows)).toEqual(rows);
  });
});

describe("groupApplicableYearRows", () => {
  it("keeps year-specific rows separated per programme", () => {
    const rows = [
      { programmeId: 1, academicYear: "2025/26", rule: "A" },
      { programmeId: 1, academicYear: "2026/27", rule: "B" },
      { programmeId: 2, academicYear: null, rule: "Legacy" },
    ];

    const grouped = groupApplicableYearRows(rows, [1, 2], "2026/27");

    expect(grouped.get(1)).toEqual([{ programmeId: 1, academicYear: "2026/27", rule: "B" }]);
    expect(grouped.get(2)).toEqual([{ programmeId: 2, academicYear: null, rule: "Legacy" }]);
  });
});
