import { Router } from "express";
import { z } from "zod";
import { and, eq, asc, desc, gte, ilike, or, isNotNull, count, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  universitiesTable,
  degreeProgrammesTable,
  subjectRequirementsTable,
  admissionRulesTable,
  admissionCutoffsTable,
  usersTable,
  careerPathsTable,
  alumniReviewsTable,
  successStoriesTable,
  roadmapsTable,
  universityAdminsTable,
} from "../db/schema/index";
import {
  listExtractionBatches,
  listExtractedRows,
  approveExtractedRow,
  rejectExtractedRow,
  bulkApproveBatch,
} from "../db/admin-review";
import { listOfficialCourses, listOfficialUniversities } from "../db/official-handbook-query";
import { requireAdmin, signInviteToken } from "../middleware/auth";
import { ROLES, ADMIN_ASSIGNABLE_ROLES, type Role } from "../lib/roles";
import { logAudit } from "../lib/audit";
import { sendInviteEmail } from "../lib/mailer";

const router = Router();

// Scoped to /admin so unmatched requests elsewhere in the API (health checks,
// typos, future routes mounted after this router) aren't swallowed by this
// gate — router.use(requireAdmin) with no path would otherwise intercept
// every request reaching this router, not just the /admin/* ones it defines.
router.use("/admin", requireAdmin);

// --- Handbook imports / extraction review -----------------------------

router.get("/admin/handbook-batches", async (req, res) => {
  const status = req.query.status as string | undefined;
  res.json(await listExtractionBatches(status));
});

router.get("/admin/extracted-rows", async (req, res) => {
  const batchId = req.query.batchId ? Number(req.query.batchId) : undefined;
  const status = req.query.status as string | undefined;
  res.json(await listExtractedRows({ batchId, status }));
});

const approveBody = z.object({
  university: z.string().optional(),
  degreeName: z.string().optional(),
  faculty: z.string().optional(),
  stream: z.string().optional(),
  district: z.string().optional(),
  minimumZScore: z.number().optional(),
});

router.post("/admin/extracted-rows/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = approveBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const hasCorrections = Object.keys(parsed.data).length > 0;
  const result = await approveExtractedRow(
    id,
    req.user!.userId,
    hasCorrections ? parsed.data : undefined,
  );

  if (!result) {
    res.status(404).json({ error: "Extracted row not found" });
    return;
  }
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

router.post("/admin/extracted-rows/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
  const result = await rejectExtractedRow(id, req.user!.userId, notes);
  if (!result) {
    res.status(404).json({ error: "Extracted row not found" });
    return;
  }
  res.json(result);
});

router.post("/admin/handbook-batches/:id/bulk-approve", async (req, res) => {
  const id = Number(req.params.id);
  res.json(await bulkApproveBatch(id, req.user!.userId));
});

// --- Universities / programmes ------------------------------------------

router.get("/admin/universities", async (_req, res) => {
  res.json(await db.select().from(universitiesTable).orderBy(asc(universitiesTable.name)));
});

const universityCreateBody = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  location: z.string().min(1),
  foundedYear: z.number().int(),
  logoColor: z.string().min(1),
  ranking: z.number().int(),
  type: z.enum(["government", "private"]).optional(),
  description: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  address: z.string().nullable().optional(),
});

router.post("/admin/universities", async (req, res) => {
  const parsed = universityCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [row] = await db
    .insert(universitiesTable)
    .values({ ...parsed.data, status: "pending_verification" })
    .returning();
  await logAudit(req.user!.userId, "university.created", { type: "university", id: row!.id });
  res.status(201).json(row);
});

const universityPatchBody = z.object({
  name: z.string().optional(),
  shortName: z.string().optional(),
  location: z.string().optional(),
  type: z.enum(["government", "private"]).optional(),
  description: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  address: z.string().nullable().optional(),
});

router.patch("/admin/universities/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = universityPatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db.update(universitiesTable).set(parsed.data).where(eq(universitiesTable.id, id));
  const [row] = await db.select().from(universitiesTable).where(eq(universitiesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "University not found" });
    return;
  }
  res.json(row);
});

const universityStatusBody = z.object({
  status: z.enum(["pending_verification", "verified", "published", "suspended", "archived"]),
});

router.patch("/admin/universities/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = universityStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [existing] = await db
    .select({ id: universitiesTable.id, status: universitiesTable.status })
    .from(universitiesTable)
    .where(eq(universitiesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "University not found" });
    return;
  }
  await db.update(universitiesTable).set({ status: parsed.data.status }).where(eq(universitiesTable.id, id));
  await logAudit(req.user!.userId, "university.status_changed", { type: "university", id }, {
    from: existing.status,
    to: parsed.data.status,
  });
  const [row] = await db.select().from(universitiesTable).where(eq(universitiesTable.id, id));
  res.json(row);
});

const universityAdminInviteBody = z.object({
  email: z.string().email(),
  universityId: z.number(),
});

router.post("/admin/university-admins/invite", async (req, res) => {
  const parsed = universityAdminInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [university] = await db
    .select({ id: universitiesTable.id })
    .from(universitiesTable)
    .where(eq(universitiesTable.id, parsed.data.universityId));
  if (!university) {
    res.status(404).json({ error: "University not found" });
    return;
  }

  const token = signInviteToken({
    email: parsed.data.email.toLowerCase(),
    role: "university_admin",
    universityId: parsed.data.universityId,
  });
  await sendInviteEmail(parsed.data.email, token, "university_admin");
  await logAudit(req.user!.userId, "university_admin.invited", {
    type: "university",
    id: parsed.data.universityId,
  }, { email: parsed.data.email });

  res.status(202).json({ message: "Invite sent." });
});

const mentorInviteBody = z.object({ email: z.string().email() });

router.post("/admin/mentors/invite", async (req, res) => {
  const parsed = mentorInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const token = signInviteToken({ email: parsed.data.email.toLowerCase(), role: "mentor" });
  await sendInviteEmail(parsed.data.email, token, "mentor");
  await logAudit(req.user!.userId, "mentor.invited", undefined, { email: parsed.data.email });

  res.status(202).json({ message: "Invite sent." });
});

router.get("/admin/university-admins", async (req, res) => {
  const universityId = req.query.universityId ? Number(req.query.universityId) : undefined;
  const rows = await db
    .select({
      id: universityAdminsTable.id,
      userId: universityAdminsTable.userId,
      universityId: universityAdminsTable.universityId,
      createdAt: universityAdminsTable.createdAt,
      email: usersTable.email,
      name: usersTable.name,
    })
    .from(universityAdminsTable)
    .innerJoin(usersTable, eq(usersTable.id, universityAdminsTable.userId))
    .where(universityId != null ? eq(universityAdminsTable.universityId, universityId) : undefined);
  res.json(rows);
});

router.delete("/admin/university-admins/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.delete(universityAdminsTable).where(eq(universityAdminsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }
  await logAudit(req.user!.userId, "university_admin.revoked", { type: "university", id: row.universityId }, {
    userId: row.userId,
  });
  res.status(204).end();
});

router.get("/admin/programmes", async (_req, res) => {
  res.json(await db.select().from(degreeProgrammesTable).orderBy(asc(degreeProgrammesTable.degreeName)));
});

const programmePatchBody = z.object({
  degreeName: z.string().optional(),
  faculty: z.string().optional(),
  degreeType: z.string().optional(),
  durationYears: z.number().optional(),
  stream: z.string().optional(),
  description: z.string().nullable().optional(),
});

router.patch("/admin/programmes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = programmePatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db.update(degreeProgrammesTable).set(parsed.data).where(eq(degreeProgrammesTable.id, id));
  const [row] = await db.select().from(degreeProgrammesTable).where(eq(degreeProgrammesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }
  res.json(row);
});

// --- Subject requirements -------------------------------------------------

router.get("/admin/subject-requirements", async (req, res) => {
  const programmeId = req.query.programmeId ? Number(req.query.programmeId) : undefined;
  const academicYear = req.query.academicYear as string | undefined;
  const conditions = [];
  if (programmeId != null) conditions.push(eq(subjectRequirementsTable.programmeId, programmeId));
  if (academicYear) conditions.push(eq(subjectRequirementsTable.academicYear, academicYear));

  if (conditions.length > 0) {
    res.json(await db.select().from(subjectRequirementsTable).where(and(...conditions)));
    return;
  }
  res.json(await db.select().from(subjectRequirementsTable));
});

const subjectRequirementBody = z.object({
  programmeId: z.number(),
  academicYear: z.string().nullable().optional(),
  requirementType: z.enum(["compulsory", "one_of", "recommended"]),
  groupKey: z.string().default("default"),
  subjectName: z.string().min(1),
  minimumGrade: z.string().nullable().optional(),
  sourceEditionId: z.number().nullable().optional(),
  sourceHandbookId: z.number().nullable().optional(),
  sourcePage: z.number().nullable().optional(),
});

router.post("/admin/subject-requirements", async (req, res) => {
  const parsed = subjectRequirementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [row] = await db.insert(subjectRequirementsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.patch("/admin/subject-requirements/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = subjectRequirementBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db.update(subjectRequirementsTable).set(parsed.data).where(eq(subjectRequirementsTable.id, id));
  const [row] = await db.select().from(subjectRequirementsTable).where(eq(subjectRequirementsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Subject requirement not found" });
    return;
  }
  res.json(row);
});

router.delete("/admin/subject-requirements/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(subjectRequirementsTable).where(eq(subjectRequirementsTable.id, id));
  res.status(204).end();
});

// --- Admission rules --------------------------------------------------------

router.get("/admin/admission-rules", async (req, res) => {
  const programmeId = req.query.programmeId ? Number(req.query.programmeId) : undefined;
  const academicYear = req.query.academicYear as string | undefined;
  const conditions = [];
  if (programmeId != null) conditions.push(eq(admissionRulesTable.programmeId, programmeId));
  if (academicYear) conditions.push(eq(admissionRulesTable.academicYear, academicYear));

  if (conditions.length > 0) {
    res.json(await db.select().from(admissionRulesTable).where(and(...conditions)));
    return;
  }
  res.json(await db.select().from(admissionRulesTable));
});

const admissionRuleBody = z.object({
  programmeId: z.number(),
  academicYear: z.string().nullable().optional(),
  ruleType: z.string().min(1),
  description: z.string().min(1),
  blocksEligibility: z.boolean().default(true),
  sourceEditionId: z.number().nullable().optional(),
  sourceHandbookId: z.number().nullable().optional(),
  sourcePage: z.number().nullable().optional(),
});

router.post("/admin/admission-rules", async (req, res) => {
  const parsed = admissionRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [row] = await db.insert(admissionRulesTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.patch("/admin/admission-rules/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = admissionRuleBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db.update(admissionRulesTable).set(parsed.data).where(eq(admissionRulesTable.id, id));
  const [row] = await db.select().from(admissionRulesTable).where(eq(admissionRulesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Admission rule not found" });
    return;
  }
  res.json(row);
});

router.delete("/admin/admission-rules/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(admissionRulesTable).where(eq(admissionRulesTable.id, id));
  res.status(204).end();
});

// --- Z-score / cutoff data --------------------------------------------------

router.get("/admin/cutoffs", async (req, res) => {
  const programmeId = req.query.programmeId ? Number(req.query.programmeId) : undefined;
  if (programmeId != null) {
    res.json(
      await db.select().from(admissionCutoffsTable).where(eq(admissionCutoffsTable.programmeId, programmeId)),
    );
    return;
  }
  res.json(await db.select().from(admissionCutoffsTable));
});

const cutoffPatchBody = z.object({
  minimumZScore: z.number().optional(),
  sourcePage: z.number().nullable().optional(),
  verifiedStatus: z.enum(["legacy_verified", "verified", "rejected"]).optional(),
});

router.patch("/admin/cutoffs/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = cutoffPatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db.update(admissionCutoffsTable).set(parsed.data).where(eq(admissionCutoffsTable.id, id));
  const [row] = await db.select().from(admissionCutoffsTable).where(eq(admissionCutoffsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Cutoff not found" });
    return;
  }
  res.json(row);
});

// --- User role management ---------------------------------------------------

const roleBody = z.object({ role: z.enum(ROLES) });
const ELEVATED_ROLES: readonly Role[] = ["admin", "super_admin"];

router.patch("/admin/users/:id/role", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = roleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const nextRole = parsed.data.role;

  if (id === req.user!.userId) {
    res.status(400).json({ error: "You cannot change your own role." });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const previousRole = existing.role as Role;

  const [actor] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  const actorIsSuperAdmin = actor?.role === "super_admin";

  // Only a super_admin may grant or revoke admin/super_admin roles.
  if (
    !actorIsSuperAdmin &&
    (ELEVATED_ROLES.includes(nextRole) || ELEVATED_ROLES.includes(previousRole))
  ) {
    res.status(403).json({ error: "Only a super admin can assign or remove elevated roles." });
    return;
  }
  if (!actorIsSuperAdmin && !ADMIN_ASSIGNABLE_ROLES.includes(nextRole as (typeof ADMIN_ASSIGNABLE_ROLES)[number])) {
    res.status(403).json({ error: "Insufficient permissions to assign this role." });
    return;
  }

  for (const guardedRole of ["admin", "super_admin"] as const) {
    if (previousRole === guardedRole && nextRole !== guardedRole) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.role, guardedRole));
      if (count <= 1) {
        res.status(400).json({ error: `Cannot demote the last remaining ${guardedRole.replace("_", " ")}.` });
        return;
      }
    }
  }

  await db.update(usersTable).set({ role: nextRole }).where(eq(usersTable.id, id));
  const [row] = await db
    .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, id));

  await logAudit(req.user!.userId, "user.role_changed", { type: "user", id }, { from: previousRole, to: nextRole });

  res.json(row);
});

router.get("/admin/users", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const role = req.query.role as string | undefined;
  const isActiveParam = req.query.isActive as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions = [];
  if (role && (ROLES as readonly string[]).includes(role)) conditions.push(eq(usersTable.role, role));
  if (isActiveParam === "true") conditions.push(eq(usersTable.isActive, true));
  if (isActiveParam === "false") conditions.push(eq(usersTable.isActive, false));
  if (search) {
    conditions.push(or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.name, `%${search}%`)));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        isActive: usersTable.isActive,
        googleId: usersTable.googleId,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(where)
      .orderBy(desc(usersTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(usersTable).where(where),
  ]);

  const users = rows.map(({ googleId, ...u }) => ({ ...u, googleLinked: !!googleId }));
  res.json({ users, total: Number(total), page, pageSize });
});

router.post("/admin/users/:id/deactivate", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.userId) {
    res.status(400).json({ error: "You cannot deactivate your own account from here." });
    return;
  }
  const [row] = await db
    .update(usersTable)
    .set({ isActive: false })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, email: usersTable.email, isActive: usersTable.isActive });
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(row);
});

router.post("/admin/users/:id/reactivate", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .update(usersTable)
    .set({ isActive: true })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, email: usersTable.email, isActive: usersTable.isActive });
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(row);
});

// --- Platform metrics ---------------------------------------------------

router.get("/admin/metrics", async (_req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    [{ totalUsers }],
    [{ activeUsers }],
    [{ googleLinkedUsers }],
    [{ newUsersLast7d }],
    [{ newUsersLast30d }],
    [{ totalCareers }],
    [{ totalReviews }],
    [{ totalStories }],
    [{ roadmapsGenerated }],
    universities,
    courses,
    recentBatches,
  ] = await Promise.all([
    db.select({ totalUsers: count() }).from(usersTable),
    db.select({ activeUsers: count() }).from(usersTable).where(eq(usersTable.isActive, true)),
    db.select({ googleLinkedUsers: count() }).from(usersTable).where(isNotNull(usersTable.googleId)),
    db.select({ newUsersLast7d: count() }).from(usersTable).where(gte(usersTable.createdAt, sevenDaysAgo)),
    db.select({ newUsersLast30d: count() }).from(usersTable).where(gte(usersTable.createdAt, thirtyDaysAgo)),
    db.select({ totalCareers: count() }).from(careerPathsTable),
    db.select({ totalReviews: count() }).from(alumniReviewsTable),
    db.select({ totalStories: count() }).from(successStoriesTable),
    db.select({ roadmapsGenerated: count() }).from(roadmapsTable),
    listOfficialUniversities(),
    listOfficialCourses({}),
    listExtractionBatches(),
  ]);

  res.json({
    totalUsers: Number(totalUsers),
    activeUsers: Number(activeUsers),
    deactivatedUsers: Number(totalUsers) - Number(activeUsers),
    googleLinkedUsers: Number(googleLinkedUsers),
    newUsersLast7d: Number(newUsersLast7d),
    newUsersLast30d: Number(newUsersLast30d),
    totalUniversities: universities.length,
    totalCourses: courses.length,
    totalCareers: Number(totalCareers),
    totalReviews: Number(totalReviews),
    totalStories: Number(totalStories),
    roadmapsGenerated: Number(roadmapsGenerated),
    recentBatches: recentBatches.slice(0, 5),
  });
});

export default router;
