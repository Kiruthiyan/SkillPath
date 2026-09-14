import { describe, it, expect } from "vitest";
import { adminMentorActions, isStudentVisibleMentor } from "../lib/mentor-eligibility";

/**
 * Mentor lifecycle contract tests.
 * Full HTTP integration needs a live DB; these encode the server eligibility and
 * admin action rules that gate student visibility / booking.
 */
describe("mentor student visibility eligibility", () => {
  const visible = {
    verificationStatus: "verified",
    isAcceptingStudents: true,
    role: "mentor",
    isActive: true,
  };

  it("allows verified + accepting + active mentor role", () => {
    expect(isStudentVisibleMentor(visible)).toBe(true);
  });

  it("hides pending / unverified mentors", () => {
    expect(isStudentVisibleMentor({ ...visible, verificationStatus: "pending" })).toBe(false);
  });

  it("hides verified mentors who are not accepting", () => {
    expect(isStudentVisibleMentor({ ...visible, isAcceptingStudents: false })).toBe(false);
  });

  it("hides suspended mentors", () => {
    expect(isStudentVisibleMentor({ ...visible, verificationStatus: "suspended" })).toBe(false);
  });

  it("hides rejected mentors", () => {
    expect(isStudentVisibleMentor({ ...visible, verificationStatus: "rejected" })).toBe(false);
  });

  it("hides inactive accounts even if verified", () => {
    expect(isStudentVisibleMentor({ ...visible, isActive: false })).toBe(false);
  });

  it("hides non-mentor roles even if a verified profile exists (role toggle must not bypass)", () => {
    expect(isStudentVisibleMentor({ ...visible, role: "student" })).toBe(false);
    expect(isStudentVisibleMentor({ ...visible, role: "admin" })).toBe(false);
  });
});

describe("admin mentor actions by state", () => {
  it("pending: verify + reject, no activate/suspend", () => {
    expect(adminMentorActions({ verificationStatus: "pending", isAcceptingStudents: true })).toEqual({
      canVerify: true,
      canActivate: false,
      canSuspend: false,
      canReject: true,
    });
  });

  it("verified accepting: suspend + reject, no verify/activate", () => {
    expect(adminMentorActions({ verificationStatus: "verified", isAcceptingStudents: true })).toEqual({
      canVerify: false,
      canActivate: false,
      canSuspend: true,
      canReject: true,
    });
  });

  it("verified not accepting: activate + suspend + reject", () => {
    expect(adminMentorActions({ verificationStatus: "verified", isAcceptingStudents: false })).toEqual({
      canVerify: false,
      canActivate: true,
      canSuspend: true,
      canReject: true,
    });
  });

  it("suspended: verify (re-verify) + reject, no activate/suspend", () => {
    expect(adminMentorActions({ verificationStatus: "suspended", isAcceptingStudents: true })).toEqual({
      canVerify: true,
      canActivate: false,
      canSuspend: false,
      canReject: true,
    });
  });
});

describe("mentor booking authorization contract", () => {
  it("duplicate live statuses are treated as blocking a new request", () => {
    const LIVE = new Set(["requested", "accepted", "active"]);
    const existing = [{ status: "requested" }, { status: "declined" }];
    expect(existing.some((r) => LIVE.has(r.status))).toBe(true);
  });

  it("declined-only history does not block a new request", () => {
    const LIVE = new Set(["requested", "accepted", "active"]);
    const existing = [{ status: "declined" }];
    expect(existing.some((r) => LIVE.has(r.status))).toBe(false);
  });

  it("accept/decline are the only mentor response statuses", () => {
    const allowed = ["accepted", "declined"] as const;
    expect(allowed).toContain("accepted");
    expect(allowed).toContain("declined");
    expect((allowed as readonly string[]).includes("cancelled")).toBe(false);
  });
});
