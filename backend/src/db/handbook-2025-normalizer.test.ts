import { describe, expect, it } from "vitest";
import {
  buildZScoreCutoffs,
  createEmptyQualityReport,
  expandEligibilityRules,
  normalizeCourseRecord,
  normalizeIntake,
  normalizeMedium,
  validateCourses,
  type NormalizedCourseRecord,
} from "./handbook-2025-normalizer";

describe("handbook 2025 normalizer", () => {
  it("converts Not Available optional values to null and builds academic_year + uni_code identity", () => {
    const course = normalizeCourseRecord({
      academic_year: "2025/2026",
      uni_code: "102M",
      university: "Wayamba University of Sri Lanka",
      course_name: "Engineering Technology (ET)",
      faculty: "Not Available",
      duration: "Not Available",
      medium: "Not Available",
      intake: "241",
      campus: "Not Available",
    });

    expect(course).toEqual({
      course_id: "2025/2026:102M",
      academic_year: "2025/2026",
      uni_code: "102M",
      university: "Wayamba University of Sri Lanka",
      course_name: "Engineering Technology (ET)",
      faculty: null,
      duration: null,
      medium: null,
      intake: 241,
      campus: null,
    });
  });

  it("normalizes medium formatting without guessing new values", () => {
    expect(normalizeMedium("English Medium")).toBe("English");
    expect(normalizeMedium("Sinhala / Tamil / English")).toEqual(["Sinhala", "Tamil", "English"]);
    expect(normalizeMedium("Sinhala and English")).toEqual(["Sinhala", "English"]);
  });

  it("reports invalid intake and duplicate course identities", () => {
    const raw = [
      { academic_year: "2025/2026", uni_code: "001A", university: "UOC", course_name: "Medicine", intake: "x" },
      { academic_year: "2025/2026", uni_code: "001A", university: "UOC", course_name: "Medicine", intake: "10" },
    ];
    const normalized = raw.map((course) => normalizeCourseRecord(course));
    const report = createEmptyQualityReport(raw.length, 0);

    validateCourses(raw, normalized, report);

    expect(normalizeIntake("x")).toBeNull();
    expect(report.invalidIntakes).toHaveLength(1);
    expect(report.duplicateUniCodes).toEqual([{ uni_code: "001A", count: 2 }]);
    expect(report.duplicateCourseIdentities).toEqual([{ identity: "2025/2026:001A", count: 2 }]);
  });

  it("expands eligibility only on exact course_name matches", () => {
    const courses: NormalizedCourseRecord[] = [
      normalizeCourseRecord({
        academic_year: "2025/2026",
        uni_code: "102M",
        university: "Wayamba University of Sri Lanka",
        course_name: "Engineering Technology (ET)",
      }),
      normalizeCourseRecord({
        academic_year: "2025/2026",
        uni_code: "143B",
        university: "University of Peradeniya",
        course_name: "Electronic and Intelligent Systems Engineering (New)",
      }),
    ];
    const report = createEmptyQualityReport(courses.length, 1);

    const expanded = expandEligibilityRules(
      courses,
      [
        {
          course_name: "Engineering Technology (ET)",
          eligible_streams: ["Engineering Technology"],
          required_subjects: ["Science for Technology"],
          minimum_grades: "At least three S passes",
          special_requirements: "Not Available",
        },
      ],
      report,
    );

    expect(expanded).toHaveLength(1);
    expect(expanded[0].uni_code).toBe("102M");
    expect(expanded[0].eligible_streams).toEqual(["Engineering Technology"]);
    expect(report.missingEligibility).toEqual([
      {
        academic_year: "2025/2026",
        uni_code: "143B",
        course_name: "Electronic and Intelligent Systems Engineering (New)",
        university: "University of Peradeniya",
      },
    ]);
  });

  it("reports invalid stream values without substituting an app-level stream", () => {
    const courses: NormalizedCourseRecord[] = [
      normalizeCourseRecord({
        academic_year: "2025/2026",
        uni_code: "102M",
        university: "Wayamba University of Sri Lanka",
        course_name: "Engineering Technology (ET)",
      }),
    ];
    const report = createEmptyQualityReport(courses.length, 1);

    expandEligibilityRules(
      courses,
      [
        {
          course_name: "Engineering Technology (ET)",
          eligible_streams: ["Engineering Technology", ""],
        },
      ],
      report,
    );

    expect(report.distinctEligibilityStreams).toEqual(["Engineering Technology"]);
    expect(report.invalidStreams).toEqual([{ course_name: "Engineering Technology (ET)", stream: "" }]);
  });

  it("maps cutoff rows only through exact unique university and course matches", () => {
    const courses: NormalizedCourseRecord[] = [
      normalizeCourseRecord({
        academic_year: "2025/2026",
        uni_code: "006A",
        university: "University of Colombo",
        course_name: "Biological Science",
      }),
    ];
    const report = createEmptyQualityReport(courses.length, 0);

    const cutoffs = buildZScoreCutoffs(
      courses,
      [
        {
          academicYear: "2024/25",
          university: "University of Colombo",
          degreeName: "Biological Science",
          district: "Colombo",
          minimumZScore: 1.6763,
          sourceSection: "9",
        },
        {
          academicYear: "2024/25",
          university: "University of Colombo",
          degreeName: "Biological Science",
          district: "Gampaha",
          zscoreMarker: "NQC",
          sourceSection: "9",
        },
        {
          academicYear: "2024/25",
          university: "Unknown",
          degreeName: "Biological Science",
          district: "Colombo",
          minimumZScore: 1.1,
          sourceSection: "9",
        },
      ],
      report,
    );

    expect(cutoffs).toEqual([
      {
        academic_year: "2024/25",
        uni_code: "006A",
        course_name: "Biological Science",
        district: "Colombo",
        cutoff: 1.6763,
      },
    ]);
    expect(report.zscoreRowsWithNonNumericCutoff).toHaveLength(1);
    expect(report.zscoreRowsWithoutUniqueCourseIdentity).toHaveLength(1);
  });

  it("reports cutoff rows that are explicitly marked for review", () => {
    const courses: NormalizedCourseRecord[] = [
      normalizeCourseRecord({
        academic_year: "2025/2026",
        uni_code: "006A",
        university: "University of Colombo",
        course_name: "Biological Science",
      }),
    ];
    const report = createEmptyQualityReport(courses.length, 0);

    const cutoffs = buildZScoreCutoffs(
      courses,
      [
        {
          academicYear: "2024/25",
          university: "University of Colombo",
          degreeName: "Biological Science",
          district: "Colombo",
          minimumZScore: 1.6763,
          sourceSection: "9",
          verificationStatus: "needs_review",
        },
      ],
      report,
    );

    expect(cutoffs).toEqual([]);
    expect(report.zscoreRowsSkippedForReview).toEqual([
      {
        academic_year: "2024/25",
        university: "University of Colombo",
        course_name: "Biological Science",
        district: "Colombo",
      },
    ]);
  });
});
