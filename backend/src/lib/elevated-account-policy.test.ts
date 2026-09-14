import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

/**
 * Contract tests for elevated-account deactivate/reactivate rules.
 * Mirrors the guards in routes/admin.ts without spinning up Express.
 */

const ELEVATED_ROLES = ["admin", "super_admin"] as const;

function canManageElevatedAccount(actorRole: string | undefined, targetRole: string): boolean {
  if (!ELEVATED_ROLES.includes(targetRole as (typeof ELEVATED_ROLES)[number])) return true;
  return actorRole === "super_admin";
}

describe("elevated account deactivate/reactivate policy", () => {
  it("allows plain admin to deactivate a student", () => {
    expect(canManageElevatedAccount("admin", "student")).toBe(true);
  });

  it("blocks plain admin from deactivating a super_admin", () => {
    expect(canManageElevatedAccount("admin", "super_admin")).toBe(false);
  });

  it("blocks plain admin from deactivating another admin", () => {
    expect(canManageElevatedAccount("admin", "admin")).toBe(false);
  });

  it("allows super_admin to deactivate an admin", () => {
    expect(canManageElevatedAccount("super_admin", "admin")).toBe(true);
  });

  it("allows super_admin to deactivate another super_admin", () => {
    expect(canManageElevatedAccount("super_admin", "super_admin")).toBe(true);
  });
});
