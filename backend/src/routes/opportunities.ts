import { Router } from "express";
import { z } from "zod";
import { and, eq, gte, or, isNull, desc } from "drizzle-orm";
import { db } from "../db/client";
import { opportunitiesTable, usersTable } from "../db/schema/index";
import { OPPORTUNITY_TYPES, OPPORTUNITY_STATUSES } from "../db/schema/opportunities";
import { requireRole, optionalAuth } from "../middleware/auth";
import { loadOwnedUniversityIds } from "../middleware/tenant";
import { canTransitionOpportunityStatus, type OpportunityStatus } from "../lib/opportunity-workflow";
import { logAudit } from "../lib/audit";
import type { Role } from "../lib/roles";

const router = Router();

// --- Public browse (published only) ------------------------------------------

router.get("/opportunities", optionalAuth, async (req, res) => {
  const type = req.query.type as string | undefined;
  const stream = req.query.stream as string | undefined;
  const universityId = req.query.universityId ? Number(req.query.universityId) : undefined;
  const activeOnly = req.query.activeOnly === "true";

  const conditions = [eq(opportunitiesTable.status, "published")];
  if (type && (OPPORTUNITY_TYPES as readonly string[]).includes(type)) {
    conditions.push(eq(opportunitiesTable.type, type));
  }
  if (stream) conditions.push(eq(opportunitiesTable.eligibilityStream, stream));
  if (universityId != null) conditions.push(eq(opportunitiesTable.universityId, universityId));
  if (activeOnly) {
    conditions.push(
      or(isNull(opportunitiesTable.applicationDeadline), gte(opportunitiesTable.applicationDeadline, new Date()))!,
    );
  }

  const rows = await db
    .select()
    .from(opportunitiesTable)
    .where(and(...conditions))
    .orderBy(desc(opportunitiesTable.createdAt));
  res.json(rows);
});

router.get("/opportunities/:id", optionalAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  if (row.status === "published") {
    res.json(row);
    return;
  }

  // Unpublished/draft/etc: only the platform admin or the owning university_admin may see it —
  // prevents scraping unpublished scholarship data by guessing ids.
  if (!req.user) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }
  const [actor] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user.userId));
  const role = actor?.role as Role | undefined;
  const isPrivileged = role === "admin" || role === "super_admin";
  const isOwner =
    role === "university_admin" &&
    row.universityId != null &&
    (await loadOwnedUniversityIds(req.user.userId)).includes(row.universityId);

  if (!isPrivileged && !isOwner && row.createdByUserId !== req.user.userId) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }
  res.json(row);
});

// --- Create / edit (admin/super_admin unrestricted; university_admin scoped) --

const opportunityCreateBody = z.object({
  type: z.enum(OPPORTUNITY_TYPES),
  title: z.string().min(1),
  description: z.string().min(1),
  organization: z.string().nullable().optional(),
  universityId: z.number().nullable().optional(),
  eligibilityStream: z.string().nullable().optional(),
  eligibilityNotes: z.string().nullable().optional(),
  applicationUrl: z.string().url().nullable().optional(),
  applicationDeadline: z.string().datetime().nullable().optional(),
  amount: z.string().nullable().optional(),
});

router.post(
  "/admin/opportunities",
  requireRole("admin", "super_admin", "university_admin"),
  async (req, res) => {
    const parsed = opportunityCreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [actor] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
    const role = actor!.role as Role;
    const isPrivileged = role === "admin" || role === "super_admin";

    if (!isPrivileged) {
      // A university_admin may only create opportunities tied to a university they own —
      // never a bare platform-wide opportunity, never someone else's university.
      if (parsed.data.universityId == null) {
        res.status(403).json({ error: "You must attach this opportunity to your university." });
        return;
      }
      const owned = await loadOwnedUniversityIds(req.user!.userId);
      if (!owned.includes(parsed.data.universityId)) {
        res.status(403).json({ error: "Not authorized for this university" });
        return;
      }
    }

    const [row] = await db
      .insert(opportunitiesTable)
      .values({
        ...parsed.data,
        applicationDeadline: parsed.data.applicationDeadline ? new Date(parsed.data.applicationDeadline) : null,
        createdByUserId: req.user!.userId,
        status: "draft",
      })
      .returning();
    await logAudit(req.user!.userId, "opportunity.created", { type: "opportunity", id: row!.id });
    res.status(201).json(row);
  },
);

const opportunityPatchBody = opportunityCreateBody.partial();

async function loadOpportunityForActor(id: number, userId: number) {
  const [row] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
  if (!row) return { row: null, canEdit: false };

  const [actor] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  const role = actor?.role as Role | undefined;
  if (role === "admin" || role === "super_admin") return { row, canEdit: true };

  if (role === "university_admin" && row.universityId != null) {
    const owned = await loadOwnedUniversityIds(userId);
    return { row, canEdit: owned.includes(row.universityId) };
  }
  return { row, canEdit: false };
}

router.patch(
  "/admin/opportunities/:id",
  requireRole("admin", "super_admin", "university_admin"),
  async (req, res) => {
    const id = Number(req.params.id);
    const parsed = opportunityPatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { row, canEdit } = await loadOpportunityForActor(id, req.user!.userId);
    if (!row) {
      res.status(404).json({ error: "Opportunity not found" });
      return;
    }
    if (!canEdit) {
      res.status(403).json({ error: "Not authorized for this opportunity" });
      return;
    }

    await db
      .update(opportunitiesTable)
      .set({
        ...parsed.data,
        applicationDeadline:
          parsed.data.applicationDeadline !== undefined
            ? parsed.data.applicationDeadline
              ? new Date(parsed.data.applicationDeadline)
              : null
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(opportunitiesTable.id, id));
    const [updated] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
    res.json(updated);
  },
);

router.delete(
  "/admin/opportunities/:id",
  requireRole("admin", "super_admin", "university_admin"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { row, canEdit } = await loadOpportunityForActor(id, req.user!.userId);
    if (!row) {
      res.status(404).json({ error: "Opportunity not found" });
      return;
    }
    if (!canEdit) {
      res.status(403).json({ error: "Not authorized for this opportunity" });
      return;
    }
    await db.delete(opportunitiesTable).where(eq(opportunitiesTable.id, id));
    res.status(204).end();
  },
);

// --- Status transitions (publish workflow) -------------------------------------

const statusBody = z.object({ status: z.enum(OPPORTUNITY_STATUSES) });

router.post(
  "/admin/opportunities/:id/status",
  requireRole("admin", "super_admin", "university_admin"),
  async (req, res) => {
    const id = Number(req.params.id);
    const parsed = statusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const [row] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
    if (!row) {
      res.status(404).json({ error: "Opportunity not found" });
      return;
    }

    const [actor] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
    const role = actor!.role as Role;
    const isOwner =
      role === "university_admin" &&
      row.universityId != null &&
      (await loadOwnedUniversityIds(req.user!.userId)).includes(row.universityId);

    const allowed = canTransitionOpportunityStatus({
      role,
      isOwner,
      from: row.status as OpportunityStatus,
      to: parsed.data.status as OpportunityStatus,
    });
    if (!allowed) {
      res.status(403).json({ error: "This status change is not permitted." });
      return;
    }

    const isReviewTransition = role === "admin" || role === "super_admin";
    await db
      .update(opportunitiesTable)
      .set({
        status: parsed.data.status,
        updatedAt: new Date(),
        ...(isReviewTransition ? { reviewedByUserId: req.user!.userId, reviewedAt: new Date() } : {}),
      })
      .where(eq(opportunitiesTable.id, id));

    await logAudit(req.user!.userId, "opportunity.status_changed", { type: "opportunity", id }, {
      from: row.status,
      to: parsed.data.status,
    });

    const [updated] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id));
    res.json(updated);
  },
);

// --- Admin listing (own or all, filtered by status) ----------------------------

router.get("/admin/opportunities", requireRole("admin", "super_admin", "university_admin"), async (req, res) => {
  const status = req.query.status as string | undefined;
  const [actor] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  const role = actor!.role as Role;
  const isPrivileged = role === "admin" || role === "super_admin";

  const statusFilter =
    status && (OPPORTUNITY_STATUSES as readonly string[]).includes(status)
      ? eq(opportunitiesTable.status, status)
      : undefined;

  if (isPrivileged) {
    const rows = await db
      .select()
      .from(opportunitiesTable)
      .where(statusFilter)
      .orderBy(desc(opportunitiesTable.createdAt));
    res.json(rows);
    return;
  }

  const owned = await loadOwnedUniversityIds(req.user!.userId);
  if (owned.length === 0) {
    res.json([]);
    return;
  }
  const rows = await Promise.all(
    owned.map((universityId) =>
      db
        .select()
        .from(opportunitiesTable)
        .where(statusFilter ? and(eq(opportunitiesTable.universityId, universityId), statusFilter) : eq(opportunitiesTable.universityId, universityId)),
    ),
  );
  res.json(rows.flat());
});

export default router;
