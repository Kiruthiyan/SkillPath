import { Router } from "express";
import { db } from "../db";
import { roadmapsTable } from "../db";
import { GenerateRoadmapBody } from "../api-zod";
import { requireActiveSession } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/ai";
import { generateRoadmapWithAI } from "../lib/gemini";
import { getOfficialCourseDetail } from "../db/official-handbook-query";
import { logger } from "../lib/logger";

const router = Router();

function parseDurationYears(duration: string | null): number {
  const match = duration?.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 4;
}

router.post("/roadmaps/generate", aiRateLimiter, requireActiveSession, async (req, res) => {
  const parsed = GenerateRoadmapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { courseId, stream, zscore } = parsed.data;

  const courseRow = await getOfficialCourseDetail(courseId, { district: "All Island" });

  if (!courseRow) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const durationYears = parseDurationYears(courseRow.duration);
  const templateCategory = courseRow.faculty ?? courseRow.degreeName;

  let years: Array<{ year: number; milestones: string[] }>;
  let afterGraduation: Array<{ timeframe: string; role: string }>;
  let aiRoadmap: Awaited<ReturnType<typeof generateRoadmapWithAI>> = null;

  logger.info(
    { degreeName: courseRow.degreeName, faculty: templateCategory },
    "Generating roadmap",
  );
  try {
    aiRoadmap = await generateRoadmapWithAI({
      degreeName: courseRow.degreeName,
      degreeType: templateCategory,
      faculty: courseRow.faculty ?? "",
      universityName: courseRow.universityName ?? "",
      durationYears,
      stream,
      zscore,
    });
    logger.info({ succeeded: !!aiRoadmap }, "Gemini roadmap generation completed");
  } catch (err) {
    logger.error({ err }, "AI roadmap generation error");
    aiRoadmap = null;
  }

  if (aiRoadmap) {
    years = aiRoadmap.years.slice(0, durationYears);
    afterGraduation = aiRoadmap.afterGraduation;
  } else {
    res.status(503).json({
      error: "Roadmap generation is temporarily unavailable. Please try again later.",
    });
    return;
  }

  while (years.length < durationYears) {
    years.push({
      year: years.length + 1,
      milestones: ["Advanced coursework", "Professional development", "Research and projects"],
    });
  }

  const result = {
    courseId,
    degreeName: courseRow.degreeName,
    years,
    afterGraduation,
  };

  await db.insert(roadmapsTable).values({
    userId: req.user!.userId,
    courseId,
    content: JSON.stringify(result),
  });

  res.json(result);
});

export default router;
