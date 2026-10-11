import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

process.env.JWT_SECRET = "test-secret";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
}));

vi.mock("../db/client", () => ({ db: mockDb }));

import { db } from "../db/client";
import { requireAuth, requireRole, signToken } from "./auth";

function mockUserRow(row: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(row ? [row] : []).then(resolve),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(chain);
}

function mockReq(token?: string, path = "/dashboard"): Request {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    path,
  } as unknown as Request;
}

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

// requireRole's returned "roleGate" is a synchronous function that kicks off
// an async DB lookup internally without returning that promise, so awaiting
// its call doesn't wait for the lookup to finish — flush the microtask queue
// instead.
function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth", () => {
  it("rejects missing Authorization header", () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth(mockReq(undefined), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid token", () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth(mockReq("garbage"), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid token", () => {
    const token = signToken({ userId: 1, email: "a@b.com", tv: 0 });
    const req = mockReq(token);
    const next = vi.fn();
    requireAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.userId).toBe(1);
  });
});

describe("requireRole", () => {
  const token = signToken({ userId: 1, email: "a@b.com", tv: 2 });

  it("rejects a user with the wrong role", async () => {
    mockUserRow({ role: "student", isActive: true, mustChangePassword: false, tokenVersion: 2 });
    const res = mockRes();
    const next = vi.fn();
    requireRole("admin")(mockReq(token), res, next);
    await flush();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a stale token (password changed since issue)", async () => {
    mockUserRow({ role: "admin", isActive: true, mustChangePassword: false, tokenVersion: 5 });
    const res = mockRes();
    const next = vi.fn();
    requireRole("admin")(mockReq(token), res, next);
    await flush();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a deactivated account", async () => {
    mockUserRow({ role: "admin", isActive: false, mustChangePassword: false, tokenVersion: 2 });
    const res = mockRes();
    const next = vi.fn();
    requireRole("admin")(mockReq(token), res, next);
    await flush();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks routes other than /change-password while mustChangePassword is set", async () => {
    mockUserRow({ role: "admin", isActive: true, mustChangePassword: true, tokenVersion: 2 });
    const res = mockRes();
    const next = vi.fn();
    requireRole("admin")(mockReq(token, "/admin/users"), res, next);
    await flush();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows /change-password through despite mustChangePassword", async () => {
    mockUserRow({ role: "admin", isActive: true, mustChangePassword: true, tokenVersion: 2 });
    const next = vi.fn();
    requireRole("admin")(mockReq(token, "/change-password"), mockRes(), next);
    await flush();
    expect(next).toHaveBeenCalled();
  });

  it("allows a correctly-roled, active, current-token user through", async () => {
    mockUserRow({ role: "admin", isActive: true, mustChangePassword: false, tokenVersion: 2 });
    const next = vi.fn();
    requireRole("admin", "super_admin")(mockReq(token), mockRes(), next);
    await flush();
    expect(next).toHaveBeenCalled();
  });
});
