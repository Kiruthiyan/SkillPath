import { Router } from "express";
import {
  universitiesTable,
  degreeProgrammesTable,
  careerPathsTable,
  alumniReviewsTable,
  successStoriesTable,
  listProgrammesWithCutoffs,
  getLatestEdition,
  type YearMode,
} from "../db";
import { db } from "../db";
import { count, sql } from "drizzle-orm";
import { buildDashboardStatsResponse } from "../lib/dashboard-stats";

const router = Router();

router.get("/dashboard/stats", async (_req, res) => {
  const [[uniCount], [courseCount], [reviewCount], [storyCount]] =
    await Promise.all([
      db.select({ count: count() }).from(universitiesTable),
      db.select({ count: count() }).from(degreeProgrammesTable),
      db.select({ count: count() }).from(alumniReviewsTable),
      db.select({ count: count() }).from(successStoriesTable),
    ]);

  const streamStats = await db
    .select({ stream: degreeProgrammesTable.stream, count: count() })
    .from(degreeProgrammesTable)
    .groupBy(degreeProgrammesTable.stream)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const edition = await getLatestEdition();

  res.json(
    buildDashboardStatsResponse(
      {
        universities: uniCount?.count ?? 0,
        courses: courseCount?.count ?? 0,
        reviews: reviewCount?.count ?? 0,
        stories: storyCount?.count ?? 0,
      },
      streamStats.map((s) => ({ stream: s.stream, count: Number(s.count) })),
      edition?.academicYear ?? null,
    ),
  );
});

router.get("/dashboard/recommendations", async (req, res) => {
  const stream = req.query.stream as string | undefined;
  const zscore = req.query.zscore ? Number(req.query.zscore) : undefined;
  const district = (req.query.district as string | undefined) ?? "All Island";
  const yearMode = ((req.query.yearMode as string) || "predicted") as YearMode;

  let courses = await listProgrammesWithCutoffs({
    stream,
    zscore,
    district,
    yearMode,
  });

  courses = courses
    .sort((a, b) => a.minimumZScore - b.minimumZScore)
    .slice(0, 6);

  const careers = await db.select().from(careerPathsTable).limit(4);
  const edition = await getLatestEdition();

  res.json({
    courses,
    careers,
    disclaimer:
      "Predictions are estimates based on past UGC cutoffs, not official admissions.",
    handbookAttribution: edition
      ? `Data from UGC University Admissions Handbook ${edition.academicYear}`
      : null,
    predictedYear: courses[0]?.predictedAcademicYear ?? null,
  });
});

export default router;
