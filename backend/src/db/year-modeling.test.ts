import { describe, expect, it } from "vitest";
import { buildCourseAvailabilityStatuses } from "./year-modeling-rules";

describe("buildCourseAvailabilityStatuses", () => {
  it("marks a removed course unavailable for the new handbook year", () => {
    expect(buildCourseAvailabilityStatuses([1, 2, 3], [1, 3])).toEqual([
      { programmeId: 1, available: true },
      { programmeId: 2, available: false },
      { programmeId: 3, available: true },
    ]);
  });

  it("marks a newly added course available in its handbook year", () => {
    expect(buildCourseAvailabilityStatuses([1, 2, 3], [1, 2, 3])).toContainEqual({
      programmeId: 3,
      available: true,
    });
  });
});
