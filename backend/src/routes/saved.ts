import { Router } from "express";
import { db } from "../db";
import {
  savedCoursesTable,
  savedUniversitiesTable,
  roadmapsTable,
  recentSearchesTable,
  degreeProgrammesTable,
  universitiesTable,
  listProgrammesWithCutoffs,
} from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  SaveCourseBody,
  SaveUniversityBody,
  RecordSearchBody,
} from "../api-zod";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/saved/courses", requireAuth, async (req, res) => {
  const saved = await db
    .select({
      programmeId: savedCoursesTable.courseId,
      savedAt: savedCoursesTable.createdAt,
    })
    .from(savedCoursesTable)
    .where(eq(savedCoursesTable.userId, req.user!.userId))
    .orderBy(desc(savedCoursesTable.createdAt));

  const programmeIds = saved.map((s) => s.programmeId);
  if (programmeIds.length === 0) {
    res.json([]);
    return;
  }

  const programmes = await listProgrammesWithCutoffs({});
  const byId = new Map(programmes.map((p) => [p.id, p]));

  const rows = saved
    .map((s) => {
      const p = byId.get(s.programmeId);
      if (!p) return null;
      return { ...p, savedAt: s.savedAt, matchScore: null };
    })
    .filter(Boolean);

  res.json(rows);
});

router.post("/saved/courses", requireAuth, async (req, res) => {
  const parsed = SaveCourseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { courseId } = parsed.data;

  const [programme] = await db
    .select({ id: degreeProgrammesTable.id })
    .from(degreeProgrammesTable)
    .where(eq(degreeProgrammesTable.id, courseId));

  if (!programme) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const [existing] = await db
    .select({ id: savedCoursesTable.id })
    .from(savedCoursesTable)
    .where(
      and(
        eq(savedCoursesTable.userId, req.user!.userId),
        eq(savedCoursesTable.courseId, courseId),
      ),
    );

  if (existing) {
    res.status(200).json({ message: "Already saved" });
    return;
  }

  await db.insert(savedCoursesTable).values({
    userId: req.user!.userId,
    courseId,
  });

  res.status(201).json({ message: "Course saved" });
});

router.delete("/saved/courses/:courseId", requireAuth, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (Number.isNaN(courseId)) {
    res.status(400).json({ error: "Invalid course ID" });
    return;
  }

  await db
    .delete(savedCoursesTable)
    .where(
      and(
        eq(savedCoursesTable.userId, req.user!.userId),
        eq(savedCoursesTable.courseId, courseId),
      ),
    );

  res.status(204).send();
});

router.get("/saved/universities", requireAuth, async (req, res) => {
  const rows = await db
    .select({
      id: universitiesTable.id,
      name: universitiesTable.name,
      shortName: universitiesTable.shortName,
      location: universitiesTable.location,
      foundedYear: universitiesTable.foundedYear,
      logoColor: universitiesTable.logoColor,
      ranking: universitiesTable.ranking,
      description: universitiesTable.description,
      savedAt: savedUniversitiesTable.createdAt,
    })
    .from(savedUniversitiesTable)
    .innerJoin(
      universitiesTable,
      eq(savedUniversitiesTable.universityId, universitiesTable.id),
    )
    .where(eq(savedUniversitiesTable.userId, req.user!.userId))
    .orderBy(desc(savedUniversitiesTable.createdAt));

  res.json(rows);
});

router.post("/saved/universities", requireAuth, async (req, res) => {
  const parsed = SaveUniversityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { universityId } = parsed.data;

  const [university] = await db
    .select({ id: universitiesTable.id })
    .from(universitiesTable)
    .where(eq(universitiesTable.id, universityId));

  if (!university) {
    res.status(404).json({ error: "University not found" });
    return;
  }

  const [existing] = await db
    .select({ id: savedUniversitiesTable.id })
    .from(savedUniversitiesTable)
    .where(
      and(
        eq(savedUniversitiesTable.userId, req.user!.userId),
        eq(savedUniversitiesTable.universityId, universityId),
      ),
    );

  if (existing) {
    res.status(200).json({ message: "Already saved" });
    return;
  }

  await db.insert(savedUniversitiesTable).values({
    userId: req.user!.userId,
    universityId,
  });

  res.status(201).json({ message: "University saved" });
});

router.delete("/saved/universities/:universityId", requireAuth, async (req, res) => {
  const universityId = Number(req.params.universityId);
  if (Number.isNaN(universityId)) {
    res.status(400).json({ error: "Invalid university ID" });
    return;
  }

  await db
    .delete(savedUniversitiesTable)
    .where(
      and(
        eq(savedUniversitiesTable.userId, req.user!.userId),
        eq(savedUniversitiesTable.universityId, universityId),
      ),
    );

  res.status(204).send();
});

router.get("/roadmaps", requireAuth, async (req, res) => {
  const rows = await db
    .select({
      id: roadmapsTable.id,
      courseId: roadmapsTable.courseId,
      content: roadmapsTable.content,
      createdAt: roadmapsTable.createdAt,
      degreeName: degreeProgrammesTable.degreeName,
    })
    .from(roadmapsTable)
    .leftJoin(
      degreeProgrammesTable,
      eq(roadmapsTable.courseId, degreeProgrammesTable.id),
    )
    .where(eq(roadmapsTable.userId, req.user!.userId))
    .orderBy(desc(roadmapsTable.createdAt));

  res.json(
    rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      degreeName: r.degreeName,
      createdAt: r.createdAt,
      roadmap: JSON.parse(r.content),
    })),
  );
});

router.get("/dashboard/recent-searches", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(recentSearchesTable)
    .where(eq(recentSearchesTable.userId, req.user!.userId))
    .orderBy(desc(recentSearchesTable.createdAt))
    .limit(10);

  res.json(
    rows.map((r) => ({
      id: r.id,
      query: r.query,
      filters: r.filters ? JSON.parse(r.filters) : null,
      createdAt: r.createdAt,
    })),
  );
});

router.post("/dashboard/recent-searches", requireAuth, async (req, res) => {
  const parsed = RecordSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [search] = await db
    .insert(recentSearchesTable)
    .values({
      userId: req.user!.userId,
      query: parsed.data.query,
      filters: parsed.data.filters ? JSON.stringify(parsed.data.filters) : null,
    })
    .returning();

  res.status(201).json({
    id: search!.id,
    query: search!.query,
    filters: parsed.data.filters ?? null,
    createdAt: search!.createdAt,
  });
});

export default router;
