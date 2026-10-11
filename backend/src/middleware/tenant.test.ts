import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { select: vi.fn() },
}));

vi.mock("../db/client", () => ({ db: mockDb }));

import { db } from "../db/client";
import { requireOwnsUniversity } from "./tenant";

function queueRows(...rowSets: unknown[][]) {
  const mock = db.select as ReturnType<typeof vi.fn>;
  for (const rows of rowSets) {
    mock.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    });
  }
}

function mockReq(userId: number): Request {
  return { user: { userId, email: "a@b.com" } } as unknown as Request;
}

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => vi.clearAllMocks());

describe("requireOwnsUniversity", () => {
  it("rejects a university_admin who does not own the target university", async () => {
    queueRows([{ role: "university_admin" }], [{ universityId: 3 }]);
    const res = mockRes();
    const next = vi.fn();
    const guard = requireOwnsUniversity(async () => 5);
    await guard(mockReq(10), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a university_admin who owns the target university", async () => {
    queueRows([{ role: "university_admin" }], [{ universityId: 5 }]);
    const next = vi.fn();
    const guard = requireOwnsUniversity(async () => 5);
    await guard(mockReq(10), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("allows admin regardless of ownership, without a client-supplied id bypassing resolution", async () => {
    queueRows([{ role: "admin" }]);
    const next = vi.fn();
    const guard = requireOwnsUniversity(async () => 999);
    await guard(mockReq(10), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("404s when the resolver cannot find the target university", async () => {
    queueRows([{ role: "university_admin" }]);
    const res = mockRes();
    const next = vi.fn();
    const guard = requireOwnsUniversity(async () => null);
    await guard(mockReq(10), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});
