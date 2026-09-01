import { Router } from "express";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db } from "../db/client";
import {
  universitiesTable,
  degreeProgrammesTable,
  subjectRequirementsTable,
  admissionRulesTable,
  admissionCutoffsTable,
  usersTable,
} from "../db/schema/index";
import {
  listExtractionBatches,
  listExtractedRows,
  approveExtractedRow,
  rejectExtractedRow,
  bulkApproveBatch,
} from "../db/admin-review";
import { requireAdmin } from "../middleware/auth";

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

const universityPatchBody = z.object({
  name: z.string().optional(),
  shortName: z.string().optional(),
  location: z.string().optional(),
  description: z.string().nullable().optional(),
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

const roleBody = z.object({ role: z.enum(["user", "admin"]) });

router.patch("/admin/users/:id/role", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = roleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  await db.update(usersTable).set({ role: parsed.data.role }).where(eq(usersTable.id, id));
  const [row] = await db
    .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(row);
});

export default router;
