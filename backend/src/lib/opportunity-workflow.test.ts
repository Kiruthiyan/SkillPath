import { describe, it, expect } from "vitest";
import { canTransitionOpportunityStatus } from "./opportunity-workflow";

describe("canTransitionOpportunityStatus", () => {
  it("allows admin to move through any transition", () => {
    expect(
      canTransitionOpportunityStatus({ role: "admin", isOwner: false, from: "verified", to: "published" }),
    ).toBe(true);
    expect(
      canTransitionOpportunityStatus({ role: "admin", isOwner: false, from: "published", to: "archived" }),
    ).toBe(true);
  });

  it("allows super_admin to move through any transition", () => {
    expect(
      canTransitionOpportunityStatus({ role: "super_admin", isOwner: false, from: "draft", to: "published" }),
    ).toBe(true);
  });

  it("allows an owning university_admin to submit draft for review", () => {
    expect(
      canTransitionOpportunityStatus({
        role: "university_admin",
        isOwner: true,
        from: "draft",
        to: "pending_verification",
      }),
    ).toBe(true);
  });

  it("blocks an owning university_admin from self-publishing", () => {
    expect(
      canTransitionOpportunityStatus({
        role: "university_admin",
        isOwner: true,
        from: "pending_verification",
        to: "published",
      }),
    ).toBe(false);
    expect(
      canTransitionOpportunityStatus({ role: "university_admin", isOwner: true, from: "draft", to: "published" }),
    ).toBe(false);
  });

  it("blocks a non-owning university_admin entirely", () => {
    expect(
      canTransitionOpportunityStatus({
        role: "university_admin",
        isOwner: false,
        from: "draft",
        to: "pending_verification",
      }),
    ).toBe(false);
  });

  it("blocks a plain mentor/user", () => {
    expect(
      canTransitionOpportunityStatus({ role: "mentor", isOwner: false, from: "draft", to: "pending_verification" }),
    ).toBe(false);
  });
});
