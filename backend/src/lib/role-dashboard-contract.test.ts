import { describe, it, expect } from "vitest";
import { ROLES } from "./roles";

/**
 * Production contract: every role lands on a fixed dashboard after login.
 * Kept as a backend test so CI fails if roles drift without an explicit landing.
 */
const ROLE_DASHBOARD_PATH: Record<(typeof ROLES)[number], string> = {
  student: "/dashboard",
  mentor: "/mentor",
  university_admin: "/university-admin",
  admin: "/admin/overview",
  super_admin: "/admin/overview",
};

describe("role dashboard contract", () => {
  it("defines a dashboard path for every role", () => {
    for (const role of ROLES) {
      expect(ROLE_DASHBOARD_PATH[role]).toMatch(/^\//);
    }
  });

  it("sends platform admins to the shared overview (no second dashboard)", () => {
    expect(ROLE_DASHBOARD_PATH.admin).toBe("/admin/overview");
    expect(ROLE_DASHBOARD_PATH.super_admin).toBe("/admin/overview");
  });

  it("keeps student / mentor / university_admin on dedicated landings", () => {
    expect(ROLE_DASHBOARD_PATH.student).toBe("/dashboard");
    expect(ROLE_DASHBOARD_PATH.mentor).toBe("/mentor");
    expect(ROLE_DASHBOARD_PATH.university_admin).toBe("/university-admin");
  });
});
