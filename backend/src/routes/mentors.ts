import { Router } from "express";
import { z } from "zod";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import { db } from "../db/client";
import { mentorProfilesTable, mentorAssignmentsTable, usersTable } from "../db/schema/index";
import { requireAuth, requireRole, optionalAuth } from "../middleware/auth";
import { MENTOR_VERIFICATION_STATUSES } from "../db/schema/mentor_profiles";
import { logAudit } from "../lib/audit";

const router = Router();

const LIVE_ASSIGNMENT_STATUSES = ["requested", "accepted", "active"] as const;

// --- Public browse (verified + accepting mentors only) ----------------------

router.get("/mentors", optionalAuth, async (req, res) => {
  const stream = req.query.stream as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions = [
    eq(mentorProfilesTable.verificationStatus, "verified"),
    eq(mentorProfilesTable.isAcceptingStudents, true),
  ];
  if (search) {
    conditions.push(
      or(ilike(mentorProfilesTable.headline, `%${search}%`), ilike(usersTable.name, `%${search}%`))!,
    );
  }

  const rows = await db
    .select({
      id: mentorProfilesTable.id,
      userId: mentorProfilesTable.userId,
      name: usersTable.name,
      headline: mentorProfilesTable.headline,
      bio: mentorProfilesTable.bio,
      expertiseAreas: mentorProfilesTable.expertiseAreas,
      yearsExperience: mentorProfilesTable.yearsExperience,
      availability: mentorProfilesTable.availability,
    })
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(and(...conditions));

  // expertiseAreas filtering done in-memory (jsonb array, small dataset) to keep the query portable.
  const filtered = stream
    ? rows.filter((r) => (r.expertiseAreas ?? []).some((a) => a.toLowerCase().includes(stream.toLowerCase())))
    : rows;

  res.json(filtered);
});

router.get("/mentors/:id", optionalAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({
      id: mentorProfilesTable.id,
      userId: mentorProfilesTable.userId,
      name: usersTable.name,
      headline: mentorProfilesTable.headline,
      bio: mentorProfilesTable.bio,
      expertiseAreas: mentorProfilesTable.expertiseAreas,
      yearsExperience: mentorProfilesTable.yearsExperience,
      availability: mentorProfilesTable.availability,
      verificationStatus: mentorProfilesTable.verificationStatus,
      isAcceptingStudents: mentorProfilesTable.isAcceptingStudents,
    })
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(eq(mentorProfilesTable.id, id));

  // 404 for anything not verified — a pending/rejected/suspended mentor must not be
  // discoverable even by guessing the id.
  if (!row || row.verificationStatus !== "verified") {
    res.status(404).json({ error: "Mentor not found" });
    return;
  }

  const { verificationStatus, ...publicRow } = row;
  void verificationStatus;
  res.json(publicRow);
});

// --- Own mentor profile -------------------------------------------------------

const mentorProfileBody = z.object({
  headline: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  expertiseAreas: z.array(z.string()).optional(),
  yearsExperience: z.number().int().nonnegative().nullable().optional(),
  availability: z.string().nullable().optional(),
  isAcceptingStudents: z.boolean().optional(),
});

router.get("/mentor/profile", requireRole("mentor"), async (req, res) => {
  const [row] = await db.select().from(mentorProfilesTable).where(eq(mentorProfilesTable.userId, req.user!.userId));
  res.json(row ?? null);
});

router.put("/mentor/profile", requireRole("mentor"), async (req, res) => {
  const parsed = mentorProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db
    .select({ id: mentorProfilesTable.id })
    .from(mentorProfilesTable)
    .where(eq(mentorProfilesTable.userId, req.user!.userId));

  if (existing) {
    // Edits to an already-verified profile do not reset verification — avoids re-review churn
    // for routine updates (bio tweaks, availability). Admins can still suspend if needed.
    await db.update(mentorProfilesTable).set(parsed.data).where(eq(mentorProfilesTable.userId, req.user!.userId));
  } else {
    await db.insert(mentorProfilesTable).values({ ...parsed.data, userId: req.user!.userId });
  }

  const [row] = await db.select().from(mentorProfilesTable).where(eq(mentorProfilesTable.userId, req.user!.userId));
  res.json(row);
});

// --- Mentor's own requests ----------------------------------------------------

router.get("/mentor/requests", requireRole("mentor"), async (req, res) => {
  const rows = await db
    .select({
      id: mentorAssignmentsTable.id,
      studentUserId: mentorAssignmentsTable.studentUserId,
      studentName: usersTable.name,
      status: mentorAssignmentsTable.status,
      message: mentorAssignmentsTable.message,
      requestedAt: mentorAssignmentsTable.requestedAt,
      respondedAt: mentorAssignmentsTable.respondedAt,
    })
    .from(mentorAssignmentsTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorAssignmentsTable.studentUserId))
    .where(eq(mentorAssignmentsTable.mentorUserId, req.user!.userId))
    .orderBy(desc(mentorAssignmentsTable.requestedAt));
  res.json(rows);
});

const requestStatusBody = z.object({ status: z.enum(["accepted", "declined"]) });

router.patch("/mentor/requests/:id", requireRole("mentor"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = requestStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db
    .select()
    .from(mentorAssignmentsTable)
    .where(eq(mentorAssignmentsTable.id, id));

  // 404 (not 403) when the row isn't this mentor's — avoids confirming the request exists at all.
  if (!existing || existing.mentorUserId !== req.user!.userId) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (existing.status !== "requested") {
    res.status(400).json({ error: "This request has already been responded to." });
    return;
  }

  await db
    .update(mentorAssignmentsTable)
    .set({ status: parsed.data.status, respondedAt: new Date() })
    .where(eq(mentorAssignmentsTable.id, id));

  const [row] = await db.select().from(mentorAssignmentsTable).where(eq(mentorAssignmentsTable.id, id));
  res.json(row);
});

// --- Student side: request a mentor / view own outgoing requests ------------

const mentorRequestBody = z.object({ message: z.string().max(2000).optional() });

router.post("/mentors/:id/request", requireAuth, async (req, res) => {
  const mentorProfileId = Number(req.params.id);
  const parsed = mentorRequestBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [mentorProfile] = await db
    .select({ userId: mentorProfilesTable.userId, verificationStatus: mentorProfilesTable.verificationStatus, isAcceptingStudents: mentorProfilesTable.isAcceptingStudents })
    .from(mentorProfilesTable)
    .where(eq(mentorProfilesTable.id, mentorProfileId));

  if (!mentorProfile || mentorProfile.verificationStatus !== "verified") {
    res.status(404).json({ error: "Mentor not found" });
    return;
  }
  if (!mentorProfile.isAcceptingStudents) {
    res.status(403).json({ error: "This mentor is not accepting new students right now." });
    return;
  }
  if (mentorProfile.userId === req.user!.userId) {
    res.status(400).json({ error: "You cannot request yourself as a mentor." });
    return;
  }

  const existingRows = await db
    .select({ status: mentorAssignmentsTable.status })
    .from(mentorAssignmentsTable)
    .where(
      and(
        eq(mentorAssignmentsTable.mentorUserId, mentorProfile.userId),
        eq(mentorAssignmentsTable.studentUserId, req.user!.userId),
      ),
    );
  if (existingRows.some((r) => (LIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(r.status))) {
    res.status(409).json({ error: "You already have an active request with this mentor." });
    return;
  }

  try {
    const [row] = await db
      .insert(mentorAssignmentsTable)
      .values({ mentorUserId: mentorProfile.userId, studentUserId: req.user!.userId, message: parsed.data.message })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    // Concurrent duplicate request slipping past the check above; DB partial unique
    // index (mentor_assignments_live_pair_idx) is the real guard against the race.
    if (err?.code === "23505") {
      res.status(409).json({ error: "You already have an active request with this mentor." });
      return;
    }
    throw err;
  }
});

router.get("/users/me/mentor-requests", requireAuth, async (req, res) => {
  const rows = await db
    .select({
      id: mentorAssignmentsTable.id,
      mentorUserId: mentorAssignmentsTable.mentorUserId,
      mentorName: usersTable.name,
      status: mentorAssignmentsTable.status,
      message: mentorAssignmentsTable.message,
      requestedAt: mentorAssignmentsTable.requestedAt,
      respondedAt: mentorAssignmentsTable.respondedAt,
    })
    .from(mentorAssignmentsTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorAssignmentsTable.mentorUserId))
    .where(eq(mentorAssignmentsTable.studentUserId, req.user!.userId))
    .orderBy(desc(mentorAssignmentsTable.requestedAt));
  res.json(rows);
});

// --- Admin: verification queue ------------------------------------------------

router.get("/admin/mentors", requireRole("admin", "super_admin"), async (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = await db
    .select({
      id: mentorProfilesTable.id,
      userId: mentorProfilesTable.userId,
      name: usersTable.name,
      email: usersTable.email,
      headline: mentorProfilesTable.headline,
      verificationStatus: mentorProfilesTable.verificationStatus,
      isAcceptingStudents: mentorProfilesTable.isAcceptingStudents,
      createdAt: mentorProfilesTable.createdAt,
    })
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(
      status && (MENTOR_VERIFICATION_STATUSES as readonly string[]).includes(status)
        ? eq(mentorProfilesTable.verificationStatus, status)
        : undefined,
    );
  res.json(rows);
});

const verifyBody = z.object({ status: z.enum(MENTOR_VERIFICATION_STATUSES) });

router.patch("/admin/mentors/:id/verify", requireRole("admin", "super_admin"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = verifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db.select().from(mentorProfilesTable).where(eq(mentorProfilesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Mentor profile not found" });
    return;
  }

  await db
    .update(mentorProfilesTable)
    .set({
      verificationStatus: parsed.data.status,
      verifiedByUserId: req.user!.userId,
      verifiedAt: new Date(),
    })
    .where(eq(mentorProfilesTable.id, id));

  await logAudit(req.user!.userId, "mentor.verification_changed", { type: "mentor_profile", id }, {
    from: existing.verificationStatus,
    to: parsed.data.status,
  });

  const [row] = await db.select().from(mentorProfilesTable).where(eq(mentorProfilesTable.id, id));
  res.json(row);
});

export default router;
