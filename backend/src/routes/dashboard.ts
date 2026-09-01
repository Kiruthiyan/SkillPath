import { Router } from "express";
import { careerPathsTable, alumniReviewsTable, successStoriesTable } from "../db";
import { db } from "../db";
import { count } from "drizzle-orm";
import {
  OFFICIAL_HANDBOOK_YEAR,
  listOfficialCourses,
  listOfficialStreams,
  listOfficialUniversities,
} from "../db/official-handbook-query";
import { buildDashboardStatsResponse } from "../lib/dashboard-stats";

const router = Router();

router.get("/dashboard/stats", async (_req, res) => {
  const [universities, courses, streams, [reviewCount], [storyCount]] = await Promise.all([
    listOfficialUniversities(),
    listOfficialCourses({}),
    listOfficialStreams(),
    db.select({ count: count() }).from(alumniReviewsTable),
    db.select({ count: count() }).from(successStoriesTable),
  ]);

  const streamStats = streams
    .map((stream) => ({
      stream,
      count: courses.filter((course) => course.eligibleStreams.includes(stream)).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json(
    buildDashboardStatsResponse(
      {
        universities: universities.length,
        courses: courses.length,
        reviews: reviewCount?.count == null ? 0 : Number(reviewCount.count),
        stories: storyCount?.count == null ? 0 : Number(storyCount.count),
      },
      streamStats,
      OFFICIAL_HANDBOOK_YEAR,
    ),
  );
});

router.get("/dashboard/recommendations", async (req, res) => {
  const stream = req.query.stream as string | undefined;
  const zscore = req.query.zscore ? Number(req.query.zscore) : undefined;
  const district = (req.query.district as string | undefined) ?? "All Island";

  const courses = (await listOfficialCourses({ stream, zscore, district }))
    .sort((a, b) => (a.minimumZScore ?? Number.MAX_SAFE_INTEGER) - (b.minimumZScore ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 6);
  const careers = await db.select().from(careerPathsTable).limit(4);

  res.json({
    courses,
    careers,
    disclaimer: "Courses and cutoffs use exact official handbook-derived local data. Missing values are shown as unavailable.",
    handbookAttribution: `Data from UGC University Admissions Handbook ${OFFICIAL_HANDBOOK_YEAR}`,
    predictedYear: null,
  });
});

export default router;
