import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { universityAdminsTable, usersTable } from "../db/schema/index";
import type { Role } from "../lib/roles";
import { canAccessUniversity } from "../lib/university-access";

export { canAccessUniversity };

export async function loadOwnedUniversityIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ universityId: universityAdminsTable.universityId })
    .from(universityAdminsTable)
    .where(eq(universityAdminsTable.userId, userId));
  return rows.map((r) => r.universityId);
}

/**
 * Guards a mutating route against cross-university access. Resolves the target university id
 * via `resolveUniversityId` (never trusts a client-supplied universityId directly) and checks
 * that the caller — unless admin/super_admin — owns it via `university_admins`.
 */
export function requireOwnsUniversity(resolveUniversityId: (req: Request) => Promise<number | null>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [actor] = await db
        .select({ role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.userId));
      if (!actor) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
      const role = actor.role as Role;

      const targetUniversityId = await resolveUniversityId(req);
      if (targetUniversityId == null) {
        res.status(404).json({ error: "University not found" });
        return;
      }

      const ownedUniversityIds =
        role === "admin" || role === "super_admin" ? [] : await loadOwnedUniversityIds(req.user!.userId);

      if (!canAccessUniversity({ role, ownedUniversityIds, targetUniversityId })) {
        res.status(403).json({ error: "Not authorized for this university" });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
