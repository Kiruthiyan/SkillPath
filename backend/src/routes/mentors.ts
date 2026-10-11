import { Router } from "express";
import { z } from "zod";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../db/client";
import { mentorProfilesTable, mentorAssignmentsTable, usersTable } from "../db/schema/index";
import { requireRole, optionalAuth, signInviteToken } from "../middleware/auth";
import { MENTOR_VERIFICATION_STATUSES } from "../db/schema/mentor_profiles";
import { logAudit } from "../lib/audit";
import { sendInviteEmail } from "../lib/mailer";
import { isStudentVisibleMentor } from "../lib/mentor-eligibility";

const router = Router();

const LIVE_ASSIGNMENT_STATUSES = ["requested", "accepted", "active"] as const;

const publicMentorSelect = {
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
  role: usersTable.role,
  isActive: usersTable.isActive,
};

function toPublicMentor(row: {
  id: number;
  userId: number;
  name: string | null;
  headline: string | null;
  bio: string | null;
  expertiseAreas: string[] | null;
  yearsExperience: number | null;
  availability: string | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    headline: row.headline,
    bio: row.bio,
    expertiseAreas: row.expertiseAreas,
    yearsExperience: row.yearsExperience,
    availability: row.availability,
  };
}

// --- Public browse (verified + accepting + active mentor role only) -----------

router.get("/mentors", optionalAuth, async (req, res) => {
  const stream = req.query.stream as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions = [
    eq(mentorProfilesTable.verificationStatus, "verified"),
    eq(mentorProfilesTable.isAcceptingStudents, true),
    eq(usersTable.role, "mentor"),
    eq(usersTable.isActive, true),
  ];
  if (search) {
    conditions.push(
      or(ilike(mentorProfilesTable.headline, `%${search}%`), ilike(usersTable.name, `%${search}%`))!,
    );
  }

  const rows = await db
    .select(publicMentorSelect)
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(and(...conditions));

  const filtered = stream
    ? rows.filter((r) => (r.expertiseAreas ?? []).some((a) => a.toLowerCase().includes(stream.toLowerCase())))
    : rows;

  res.json(filtered.map(toPublicMentor));
});

router.get("/mentors/:id", optionalAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select(publicMentorSelect)
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(eq(mentorProfilesTable.id, id));

  if (!row || !isStudentVisibleMentor(row)) {
    res.status(404).json({ error: "Mentor not found" });
    return;
  }

  res.json(toPublicMentor(row));
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
    .select({ id: mentorProfilesTable.id, verificationStatus: mentorProfilesTable.verificationStatus })
    .from(mentorProfilesTable)
    .where(eq(mentorProfilesTable.userId, req.user!.userId));

  if (existing?.verificationStatus === "suspended") {
    res.status(403).json({ error: "Your mentor account is suspended." });
    return;
  }

  if (existing) {
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

  const [mentorProfile] = await db
    .select({ verificationStatus: mentorProfilesTable.verificationStatus })
    .from(mentorProfilesTable)
    .where(eq(mentorProfilesTable.userId, req.user!.userId));
  if (mentorProfile?.verificationStatus === "suspended") {
    res.status(403).json({ error: "Your mentor account is suspended." });
    return;
  }

  const [existing] = await db
    .select()
    .from(mentorAssignmentsTable)
    .where(eq(mentorAssignmentsTable.id, id));

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

router.post("/mentors/:id/request", requireRole("student"), async (req, res) => {
  const mentorProfileId = Number(req.params.id);
  const parsed = mentorRequestBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [mentorRow] = await db
    .select({
      userId: mentorProfilesTable.userId,
      verificationStatus: mentorProfilesTable.verificationStatus,
      isAcceptingStudents: mentorProfilesTable.isAcceptingStudents,
      role: usersTable.role,
      isActive: usersTable.isActive,
    })
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(eq(mentorProfilesTable.id, mentorProfileId));

  if (!mentorRow || !isStudentVisibleMentor(mentorRow)) {
    res.status(404).json({ error: "Mentor not found" });
    return;
  }
  if (mentorRow.userId === req.user!.userId) {
    res.status(400).json({ error: "You cannot request yourself as a mentor." });
    return;
  }

  const existingRows = await db
    .select({ status: mentorAssignmentsTable.status })
    .from(mentorAssignmentsTable)
    .where(
      and(
        eq(mentorAssignmentsTable.mentorUserId, mentorRow.userId),
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
      .values({ mentorUserId: mentorRow.userId, studentUserId: req.user!.userId, message: parsed.data.message })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "You already have an active request with this mentor." });
      return;
    }
    throw err;
  }
});

router.get("/users/me/mentor-requests", requireRole("student"), async (req, res) => {
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

// --- Admin: create / list / detail / edit / verify ----------------------------

const adminMentorCreateBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  headline: z.string().max(500).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  expertiseAreas: z.array(z.string().max(100)).max(30).optional(),
  yearsExperience: z.number().int().nonnegative().nullable().optional(),
  availability: z.string().max(500).nullable().optional(),
  isAcceptingStudents: z.boolean().optional(),
});

const adminMentorPatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  headline: z.string().max(500).nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  expertiseAreas: z.array(z.string().max(100)).max(30).optional(),
  yearsExperience: z.number().int().nonnegative().nullable().optional(),
  availability: z.string().max(500).nullable().optional(),
  isAcceptingStudents: z.boolean().optional(),
});

const adminMentorListSelect = {
  id: mentorProfilesTable.id,
  userId: mentorProfilesTable.userId,
  name: usersTable.name,
  email: usersTable.email,
  isActive: usersTable.isActive,
  role: usersTable.role,
  headline: mentorProfilesTable.headline,
  bio: mentorProfilesTable.bio,
  expertiseAreas: mentorProfilesTable.expertiseAreas,
  yearsExperience: mentorProfilesTable.yearsExperience,
  availability: mentorProfilesTable.availability,
  verificationStatus: mentorProfilesTable.verificationStatus,
  isAcceptingStudents: mentorProfilesTable.isAcceptingStudents,
  verifiedByUserId: mentorProfilesTable.verifiedByUserId,
  verifiedAt: mentorProfilesTable.verifiedAt,
  createdAt: mentorProfilesTable.createdAt,
};

router.post("/admin/mentors", requireRole("admin", "super_admin"), async (req, res) => {
  const parsed = adminMentorCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existingUser) {
    res.status(409).json({ error: "A user with this email already exists." });
    return;
  }

  const tempPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(usersTable)
      .values({
        email,
        name: parsed.data.name,
        passwordHash,
        role: "mentor",
        language: "en",
        mustChangePassword: true,
      })
      .returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name });

    const [profile] = await tx
      .insert(mentorProfilesTable)
      .values({
        userId: user.id,
        headline: parsed.data.headline ?? null,
        bio: parsed.data.bio ?? null,
        expertiseAreas: parsed.data.expertiseAreas ?? [],
        yearsExperience: parsed.data.yearsExperience ?? null,
        availability: parsed.data.availability ?? null,
        isAcceptingStudents: parsed.data.isAcceptingStudents ?? true,
        verificationStatus: "pending",
      })
      .returning();

    return { user, profile };
  });

  const token = signInviteToken({ email, role: "mentor" });
  await sendInviteEmail(email, token, "mentor");
  await logAudit(req.user!.userId, "mentor.created", { type: "mentor_profile", id: created.profile.id }, {
    email,
    verificationStatus: "pending",
  });

  const [row] = await db
    .select(adminMentorListSelect)
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(eq(mentorProfilesTable.id, created.profile.id));

  res.status(201).json(row);
});

router.get("/admin/mentors", requireRole("admin", "super_admin"), async (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = await db
    .select(adminMentorListSelect)
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(
      status && (MENTOR_VERIFICATION_STATUSES as readonly string[]).includes(status)
        ? eq(mentorProfilesTable.verificationStatus, status)
        : undefined,
    )
    .orderBy(desc(mentorProfilesTable.createdAt));
  res.json(rows);
});

router.get("/admin/mentors/:id", requireRole("admin", "super_admin"), async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select(adminMentorListSelect)
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(eq(mentorProfilesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Mentor profile not found" });
    return;
  }
  res.json(row);
});

router.patch("/admin/mentors/:id", requireRole("admin", "super_admin"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = adminMentorPatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [existing] = await db.select().from(mentorProfilesTable).where(eq(mentorProfilesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Mentor profile not found" });
    return;
  }

  const { name, ...profileFields } = parsed.data;

  await db.transaction(async (tx) => {
    if (name !== undefined) {
      await tx.update(usersTable).set({ name }).where(eq(usersTable.id, existing.userId));
    }
    if (Object.keys(profileFields).length > 0) {
      await tx.update(mentorProfilesTable).set(profileFields).where(eq(mentorProfilesTable.id, id));
    }
  });

  await logAudit(req.user!.userId, "mentor.updated", { type: "mentor_profile", id }, parsed.data);

  const [row] = await db
    .select(adminMentorListSelect)
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(eq(mentorProfilesTable.id, id));
  res.json(row);
});

const verifyBody = z.object({
  status: z.enum(MENTOR_VERIFICATION_STATUSES),
  isAcceptingStudents: z.boolean().optional(),
});

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

  const updates: {
    verificationStatus: (typeof MENTOR_VERIFICATION_STATUSES)[number];
    verifiedByUserId: number;
    verifiedAt: Date;
    isAcceptingStudents?: boolean;
  } = {
    verificationStatus: parsed.data.status,
    verifiedByUserId: req.user!.userId,
    verifiedAt: new Date(),
  };
  if (parsed.data.isAcceptingStudents !== undefined) {
    updates.isAcceptingStudents = parsed.data.isAcceptingStudents;
  }

  await db.update(mentorProfilesTable).set(updates).where(eq(mentorProfilesTable.id, id));

  await logAudit(req.user!.userId, "mentor.verification_changed", { type: "mentor_profile", id }, {
    from: existing.verificationStatus,
    to: parsed.data.status,
    isAcceptingStudents: parsed.data.isAcceptingStudents,
  });

  const [row] = await db
    .select(adminMentorListSelect)
    .from(mentorProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
    .where(eq(mentorProfilesTable.id, id));
  res.json(row);
});

export default router;
