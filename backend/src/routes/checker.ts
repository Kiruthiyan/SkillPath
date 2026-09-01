import { Router } from "express";
import { z } from "zod";
import {
  listCheckerProgrammes,
  getCheckerProgrammeDetail,
  getVerifiedCutoffHistory,
  type CheckerLanguage,
} from "../db/checker-query";
import { getCheckerRecommendations } from "../db/checker-recommendations";
import { computeZScoreEstimate } from "../db/estimate";
import { evaluateEligibility } from "../db/eligibility-engine";
import { db } from "../db/client";
import { academicYearsTable, handbookEditionsTable, subjectRequirementsTable } from "../db/schema/index";
import { UGC_STREAMS } from "../db/constants/districts";
import { nextAcademicYear } from "../db/predict";

const router = Router();

function parseLang(value: unknown): CheckerLanguage {
  return value === "si" || value === "ta" ? value : "en";
}

router.get("/checker/streams", (_req, res) => {
  res.json(UGC_STREAMS);
});

router.get("/checker/academic-years", async (_req, res) => {
  const [trackedYears, editionYears] = await Promise.all([
    db
      .select({
        academicYear: academicYearsTable.academicYear,
        handbookAvailable: academicYearsTable.handbookAvailable,
      })
      .from(academicYearsTable),
    db.select({ academicYear: handbookEditionsTable.academicYear }).from(handbookEditionsTable),
  ]);

  const years = new Map<string, { academicYear: string; handbookAvailable: boolean }>();
  for (const row of editionYears) {
    years.set(row.academicYear, { academicYear: row.academicYear, handbookAvailable: true });
  }
  for (const row of trackedYears) {
    years.set(row.academicYear, row);
  }

  const sorted = Array.from(years.values()).sort((a, b) => a.academicYear.localeCompare(b.academicYear));
  const latest = sorted[sorted.length - 1]?.academicYear;
  if (latest) {
    const nextYear = nextAcademicYear(latest);
    if (!years.has(nextYear)) {
      sorted.push({ academicYear: nextYear, handbookAvailable: false });
    }
  }

  res.json(sorted);
});

router.get("/checker/subjects", async (_req, res) => {
  const rows = await db
    .selectDistinct({ subjectName: subjectRequirementsTable.subjectName })
    .from(subjectRequirementsTable);
  res.json(rows.map((r) => r.subjectName).sort());
});

const recommendationsBody = z.object({
  academicYear: z.string().min(1),
  district: z.string().min(1),
  stream: z.string().min(1),
  subjectGrades: z.record(z.string(), z.string()).default({}),
  zscore: z.number(),
});

router.post("/checker/recommendations", async (req, res) => {
  const parsed = recommendationsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const recommendations = await getCheckerRecommendations(parsed.data);
  res.json(recommendations);
});

router.get("/checker/programmes", async (req, res) => {
  const stream = req.query.stream as string | undefined;
  const district = (req.query.district as string | undefined) ?? undefined;
  const universityId = req.query.universityId ? Number(req.query.universityId) : undefined;
  const lang = parseLang(req.query.lang);

  const programmes = await listCheckerProgrammes({ stream, universityId, lang });
  res.json({ district: district ?? null, programmes });
});

router.get("/checker/programmes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const lang = parseLang(req.query.lang);
  const academicYear = req.query.academicYear as string | undefined;
  const detail = await getCheckerProgrammeDetail(id, lang, academicYear);

  if (!detail) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }

  const district = (req.query.district as string | undefined) ?? "All Island";
  const history = await getVerifiedCutoffHistory(id, district);

  res.json({ ...detail, district, historicalCutoffs: history });
});

router.get("/checker/programmes/:id/estimate", async (req, res) => {
  const id = Number(req.params.id);
  const district = (req.query.district as string | undefined) ?? "All Island";
  const zscore = req.query.zscore ? Number(req.query.zscore) : undefined;

  const history = await getVerifiedCutoffHistory(id, district);
  if (history.length === 0) {
    res.status(404).json({ error: "No verified cutoff history for this programme/district" });
    return;
  }

  const estimate = computeZScoreEstimate(history, zscore != null && !Number.isNaN(zscore) ? zscore : undefined);
  res.json(estimate);
});

const eligibilityBody = z.object({
  academicYear: z.string().min(1).optional(),
  stream: z.string().min(1),
  subjectGrades: z.record(z.string(), z.string()).default({}),
  zscore: z.number(),
  district: z.string().min(1),
});

router.post("/checker/programmes/:id/eligibility", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = eligibilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const result = await evaluateEligibility(id, parsed.data);
  if (!result) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }

  res.json(result);
});

export default router;
