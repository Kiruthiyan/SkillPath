import { Router, type Request } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  universitiesTable,
  degreeProgrammesTable,
  universityAnnouncementsTable,
  usersTable,
} from "../db/schema/index";
import { requireRole } from "../middleware/auth";
import { requireOwnsUniversity, loadOwnedUniversityIds } from "../middleware/tenant";
import { logAudit } from "../lib/audit";

const router = Router();

router.use("/university-admin", requireRole("university_admin", "admin", "super_admin"));

async function isAdminActor(userId: number): Promise<boolean> {
  const [row] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  return row?.role === "admin" || row?.role === "super_admin";
}

// --- Own universities -------------------------------------------------------

router.get("/university-admin/me/universities", async (req, res) => {
  const ownedIds = await loadOwnedUniversityIds(req.user!.userId);
  const rows = await Promise.all(
    ownedIds.map(async (id) => {
      const [row] = await db.select().from(universitiesTable).where(eq(universitiesTable.id, id));
      return row;
    }),
  );
  res.json(rows.filter(Boolean));
});

const universityProfilePatchBody = z.object({
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  address: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

async function resolveUniversityIdFromParam(req: Request): Promise<number | null> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return null;
  const [row] = await db.select({ id: universitiesTable.id }).from(universitiesTable).where(eq(universitiesTable.id, id));
  return row?.id ?? null;
}

router.patch(
  "/university-admin/universities/:id",
  requireOwnsUniversity(resolveUniversityIdFromParam),
  async (req, res) => {
    const id = Number(req.params.id);
    const parsed = universityProfilePatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    // status/name/shortName/location stay platform-admin-only — see PATCH /admin/universities/:id/status.
    await db.update(universitiesTable).set(parsed.data).where(eq(universitiesTable.id, id));
    const [row] = await db.select().from(universitiesTable).where(eq(universitiesTable.id, id));
    res.json(row);
  },
);

// --- Programmes (own university only) ---------------------------------------

async function resolveUniversityIdFromProgramme(req: Request): Promise<number | null> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return null;
  const [row] = await db
    .select({ universityId: degreeProgrammesTable.universityId })
    .from(degreeProgrammesTable)
    .where(eq(degreeProgrammesTable.id, id));
  return row?.universityId ?? null;
}

router.get("/university-admin/programmes", async (req, res) => {
  const ownedIds = await loadOwnedUniversityIds(req.user!.userId);
  const rows = await Promise.all(
    ownedIds.map((universityId) =>
      db.select().from(degreeProgrammesTable).where(eq(degreeProgrammesTable.universityId, universityId)),
    ),
  );
  res.json(rows.flat());
});

const programmePatchBody = z.object({
  degreeName: z.string().optional(),
  faculty: z.string().optional(),
  degreeType: z.string().optional(),
  durationYears: z.number().optional(),
  description: z.string().nullable().optional(),
});

router.patch(
  "/university-admin/programmes/:id",
  requireOwnsUniversity(resolveUniversityIdFromProgramme),
  async (req, res) => {
    const id = Number(req.params.id);
    const parsed = programmePatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    await db.update(degreeProgrammesTable).set(parsed.data).where(eq(degreeProgrammesTable.id, id));
    const [row] = await db.select().from(degreeProgrammesTable).where(eq(degreeProgrammesTable.id, id));
    res.json(row);
  },
);

// --- Announcements ------------------------------------------------------------

router.get("/university-admin/announcements", async (req, res) => {
  const universityId = req.query.universityId ? Number(req.query.universityId) : undefined;
  const ownedIds = await loadOwnedUniversityIds(req.user!.userId);

  if (universityId != null && !ownedIds.includes(universityId) && !(await isAdminActor(req.user!.userId))) {
    res.status(403).json({ error: "Not authorized for this university" });
    return;
  }

  const targetIds = universityId != null ? [universityId] : ownedIds;
  const rows = await Promise.all(
    targetIds.map((id) =>
      db.select().from(universityAnnouncementsTable).where(eq(universityAnnouncementsTable.universityId, id)),
    ),
  );
  res.json(rows.flat());
});

const announcementBody = z.object({
  universityId: z.number(),
  title: z.string().min(1),
  body: z.string().min(1),
  link: z.string().url().nullable().optional(),
});

router.post(
  "/university-admin/announcements",
  requireOwnsUniversity(async (req) => {
    const parsed = announcementBody.pick({ universityId: true }).safeParse(req.body);
    return parsed.success ? parsed.data.universityId : null;
  }),
  async (req, res) => {
    const parsed = announcementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const [row] = await db
      .insert(universityAnnouncementsTable)
      .values({ ...parsed.data, createdByUserId: req.user!.userId, publishedAt: new Date() })
      .returning();
    await logAudit(req.user!.userId, "announcement.created", { type: "university", id: parsed.data.universityId });
    res.status(201).json(row);
  },
);

async function resolveUniversityIdFromAnnouncement(req: Request): Promise<number | null> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return null;
  const [row] = await db
    .select({ universityId: universityAnnouncementsTable.universityId })
    .from(universityAnnouncementsTable)
    .where(eq(universityAnnouncementsTable.id, id));
  return row?.universityId ?? null;
}

const announcementPatchBody = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  link: z.string().url().nullable().optional(),
});

router.patch(
  "/university-admin/announcements/:id",
  requireOwnsUniversity(resolveUniversityIdFromAnnouncement),
  async (req, res) => {
    const id = Number(req.params.id);
    const parsed = announcementPatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    await db.update(universityAnnouncementsTable).set(parsed.data).where(eq(universityAnnouncementsTable.id, id));
    const [row] = await db.select().from(universityAnnouncementsTable).where(eq(universityAnnouncementsTable.id, id));
    res.json(row);
  },
);

router.delete(
  "/university-admin/announcements/:id",
  requireOwnsUniversity(resolveUniversityIdFromAnnouncement),
  async (req, res) => {
    const id = Number(req.params.id);
    await db.delete(universityAnnouncementsTable).where(eq(universityAnnouncementsTable.id, id));
    res.status(204).end();
  },
);

export default router;
