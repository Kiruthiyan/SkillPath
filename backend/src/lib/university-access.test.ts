import { describe, it, expect } from "vitest";
import { canAccessUniversity } from "./university-access";

describe("canAccessUniversity", () => {
  it("allows admin regardless of ownership", () => {
    expect(canAccessUniversity({ role: "admin", ownedUniversityIds: [], targetUniversityId: 5 })).toBe(true);
  });

  it("allows super_admin regardless of ownership", () => {
    expect(canAccessUniversity({ role: "super_admin", ownedUniversityIds: [], targetUniversityId: 5 })).toBe(true);
  });

  it("allows university_admin who owns the target university", () => {
    expect(
      canAccessUniversity({ role: "university_admin", ownedUniversityIds: [3, 5], targetUniversityId: 5 }),
    ).toBe(true);
  });

  it("rejects university_admin who does not own the target university", () => {
    expect(
      canAccessUniversity({ role: "university_admin", ownedUniversityIds: [3], targetUniversityId: 5 }),
    ).toBe(false);
  });

});
