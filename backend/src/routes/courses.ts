import { Router } from "express";
import {
  listProgrammesWithCutoffs,
  getProgrammeDetail,
  getPredictionInsight,
  type YearMode,
} from "../db";
import { degreeProgrammesTable, careerPathsTable } from "../db";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { explainCutoffPrediction } from "../lib/gemini";

const router = Router();

router.get("/courses", async (req, res) => {
  const stream = req.query.stream as string | undefined;
  const zscore = req.query.zscore ? Number(req.query.zscore) : undefined;
  const universityId = req.query.universityId
    ? Number(req.query.universityId)
    : undefined;
  const degreeType = req.query.degreeType as string | undefined;
  const duration = req.query.duration ? Number(req.query.duration) : undefined;
  const faculty = req.query.faculty as string | undefined;
  const district = (req.query.district as string | undefined) ?? "All Island";
  const yearMode = ((req.query.yearMode as string) || "predicted") as YearMode;
  const academicYear = req.query.academicYear as string | undefined;

  if (zscore != null && !Number.isNaN(zscore) && !req.query.district) {
    res.status(400).json({
      error: "district is required when filtering by zscore",
    });
    return;
  }

  const courses = await listProgrammesWithCutoffs({
    stream,
    zscore,
    universityId,
    degreeType,
    duration,
    faculty,
    district,
    yearMode,
    academicYear,
  });

  res.json(courses);
});

router.get("/courses/:id/prediction-insight", async (req, res) => {
  const id = Number(req.params.id);
  const district = (req.query.district as string | undefined) ?? "All Island";
  const zscore = req.query.zscore ? Number(req.query.zscore) : undefined;

  const insight = await getPredictionInsight(
    id,
    district,
    zscore != null && !Number.isNaN(zscore) ? zscore : undefined,
  );

  if (!insight) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const explanation = await explainCutoffPrediction({
    programme: insight.programme,
    district: insight.district,
    history: insight.history,
    predicted: insight.prediction,
    studentZscore: insight.studentZscore ?? undefined,
    eligibility: insight.eligibility,
    handbookAttribution: insight.handbookAttribution,
  });

  res.json({
    ...insight,
    explanation,
  });
});

router.get("/courses/:id", async (req, res) => {
  const id = Number(req.params.id);
  const district = (req.query.district as string | undefined) ?? "All Island";
  const yearMode = ((req.query.yearMode as string) || "predicted") as YearMode;

  const row = await getProgrammeDetail(id, district, yearMode);

  if (!row) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  res.json(row);
});

router.get("/courses/:id/careers", async (req, res) => {
  const id = Number(req.params.id);
  const [programme] = await db
    .select({ degreeType: degreeProgrammesTable.degreeType })
    .from(degreeProgrammesTable)
    .where(eq(degreeProgrammesTable.id, id));

  if (!programme) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const careers = await db
    .select()
    .from(careerPathsTable)
    .where(eq(careerPathsTable.degreeType, programme.degreeType));

  res.json(careers);
});

export default router;
