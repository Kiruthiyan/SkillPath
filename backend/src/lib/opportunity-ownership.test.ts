import { describe, it, expect } from "vitest";

/**
 * Documents the university_admin opportunity PATCH ownership rule introduced
 * to prevent reassignment of an opportunity to another university (or null)
 * after the actor only proved ownership of the *current* row.
 */
function canUniversityAdminReassignOpportunity(params: {
  ownedUniversityIds: number[];
  nextUniversityId: number | null | undefined;
}): { ok: boolean; reason?: string } {
  if (params.nextUniversityId === undefined) return { ok: true };
  if (params.nextUniversityId == null) {
    return { ok: false, reason: "detach_forbidden" };
  }
  if (!params.ownedUniversityIds.includes(params.nextUniversityId)) {
    return { ok: false, reason: "not_owned" };
  }
  return { ok: true };
}

describe("university_admin opportunity universityId reassignment", () => {
  it("allows omitting universityId (no change)", () => {
    expect(
      canUniversityAdminReassignOpportunity({ ownedUniversityIds: [1], nextUniversityId: undefined }),
    ).toEqual({ ok: true });
  });

  it("forbids detaching to null", () => {
    expect(
      canUniversityAdminReassignOpportunity({ ownedUniversityIds: [1], nextUniversityId: null }),
    ).toEqual({ ok: false, reason: "detach_forbidden" });
  });

  it("forbids reassignment to an unowned university", () => {
    expect(
      canUniversityAdminReassignOpportunity({ ownedUniversityIds: [1], nextUniversityId: 9 }),
    ).toEqual({ ok: false, reason: "not_owned" });
  });

  it("allows reassignment within owned universities", () => {
    expect(
      canUniversityAdminReassignOpportunity({ ownedUniversityIds: [1, 2], nextUniversityId: 2 }),
    ).toEqual({ ok: true });
  });
});
