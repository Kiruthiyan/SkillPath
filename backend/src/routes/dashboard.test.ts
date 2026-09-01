import { describe, expect, it } from "vitest";
import { buildDashboardStatsResponse } from "../lib/dashboard-stats";

describe("buildDashboardStatsResponse", () => {
  it("maps counts to OpenAPI field names", () => {
    const result = buildDashboardStatsResponse(
      { universities: 15, courses: 420, reviews: 12, stories: 8 },
      [
        { stream: "Physical Science", count: 120 },
        { stream: "Commerce", count: 80 },
      ],
      "2025/2026",
    );

    expect(result).toEqual({
      totalUniversities: 15,
      totalCourses: 420,
      totalReviews: 12,
      totalSuccessStories: 8,
      topStreams: [
        { stream: "Physical Science", courseCount: 120 },
        { stream: "Commerce", courseCount: 80 },
      ],
      handbookYear: "2025/2026",
    });
  });

  it("handles zero counts and null handbook year", () => {
    const result = buildDashboardStatsResponse(
      { universities: 0, courses: 0, reviews: 0, stories: 0 },
      [],
      null,
    );

    expect(result.totalUniversities).toBe(0);
    expect(result.topStreams).toEqual([]);
    expect(result.handbookYear).toBeNull();
  });
});
