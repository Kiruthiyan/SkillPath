import { Router } from "express";
import { z } from "zod";
import {
  OFFICIAL_HANDBOOK_YEAR,
  getOfficialCheckerRecommendations,
  getOfficialCourseDetail,
  listOfficialAcademicYears,
  listOfficialCourses,
  listOfficialStreams,
  listOfficialSubjects,
} from "../db/official-handbook-query";

const router = Router();

function isPassingGrade(grade: string | undefined): boolean {
  return !!grade && grade.toUpperCase() !== "F";
}

function isSimpleSubjectRequirement(subject: string): boolean {
  return !/\b(one of|or|from|must include|at least|any)\b|[:;]/i.test(subject);
}

router.get("/checker/streams", async (_req, res) => {
  res.json(await listOfficialStreams());
});

router.get("/checker/academic-years", async (_req, res) => {
  res.json(await listOfficialAcademicYears());
});

router.get("/checker/subjects", async (_req, res) => {
  res.json(await listOfficialSubjects());
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

  const recommendations = await getOfficialCheckerRecommendations(parsed.data);
  res.json(recommendations);
});

router.get("/checker/programmes", async (req, res) => {
  const stream = req.query.stream as string | undefined;
  const district = (req.query.district as string | undefined) ?? undefined;
  const universityId = req.query.universityId ? Number(req.query.universityId) : undefined;

  const courses = await listOfficialCourses({ stream, universityId, district });
  res.json({
    district: district ?? null,
    programmes: courses.map((course) => ({
      id: course.id,
      universityId: course.universityId,
      universityName: course.universityName,
      degreeName: course.degreeName,
      faculty: course.faculty,
      degreeType: course.degreeType,
      duration: course.duration,
      durationYears: course.durationYears,
      stream: course.stream ?? "",
      eligibleStreams: course.eligibleStreams,
    })),
  });
});

router.get("/checker/programmes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const academicYear = (req.query.academicYear as string | undefined) ?? OFFICIAL_HANDBOOK_YEAR;
  const district = (req.query.district as string | undefined) ?? "All Island";
  const detail = await getOfficialCourseDetail(id, { academicYear, district });

  if (!detail) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }

  res.json({
    id: detail.id,
    universityId: detail.universityId,
    universityName: detail.universityName,
    degreeName: detail.degreeName,
    faculty: detail.faculty,
    degreeType: detail.degreeType,
    duration: detail.duration,
    durationYears: detail.durationYears,
    stream: detail.stream ?? "",
    description: detail.description,
    subjectRequirements: detail.subjects.map((subjectName, index) => ({
      id: index + 1,
      requirementType: "official_text",
      groupKey: "official",
      subjectName,
      minimumGrade: null,
      sourcePage: null,
    })),
    admissionRules: [...detail.minimumGrades, ...detail.specialRequirements].map((description, index) => ({
      id: index + 1,
      ruleType: "official_text",
      description,
      blocksEligibility: false,
      sourcePage: null,
    })),
    district,
    historicalCutoffs: detail.cutoffHistory,
  });
});

router.get("/checker/programmes/:id/estimate", async (req, res) => {
  const id = Number(req.params.id);
  const district = (req.query.district as string | undefined) ?? "All Island";
  const zscore = req.query.zscore ? Number(req.query.zscore) : undefined;
  const detail = await getOfficialCourseDetail(id, { district });

  if (!detail || detail.cutoffHistory.length === 0) {
    res.status(404).json({ error: "No verified cutoff history for this programme/district" });
    return;
  }

  const latest = detail.cutoffHistory[0]?.minimumZScore ?? null;
  const statusLabel =
    latest != null && zscore != null && !Number.isNaN(zscore)
      ? zscore >= latest
        ? "competitive_range"
        : "below_recent_range"
      : null;

  res.json({
    hasSufficientData: detail.cutoffHistory.length > 0,
    historicalCutoffs: detail.cutoffHistory,
    weightedEstimate: latest,
    rangeLow: latest,
    rangeHigh: latest,
    yearsUsed: detail.cutoffHistory.length,
    statusLabel,
  });
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

  const detail = await getOfficialCourseDetail(id, {
    academicYear: parsed.data.academicYear ?? OFFICIAL_HANDBOOK_YEAR,
    district: parsed.data.district,
  });
  if (!detail) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }

  const streamPass = detail.eligibleStreams.includes(parsed.data.stream);
  const hasSubjectGrades = Object.keys(parsed.data.subjectGrades || {}).some(
    (k) => parsed.data.subjectGrades[k] && parsed.data.subjectGrades[k].trim() !== ""
  );
  const missingSubjects = hasSubjectGrades
    ? detail.subjects
        .filter(isSimpleSubjectRequirement)
        .filter((subject) => {
          const grade = parsed.data.subjectGrades[subject];
          if (!grade) {
            const totalEntered = Object.keys(parsed.data.subjectGrades).filter(
              (k) => parsed.data.subjectGrades[k]?.trim()
            ).length;
            return totalEntered >= 3;
          }
          return !isPassingGrade(grade);
        })
    : [];
  const zscorePass =
    detail.officialMinimumZScore == null ? false : parsed.data.zscore >= detail.officialMinimumZScore;

  res.json({
    eligible: streamPass && missingSubjects.length === 0 && zscorePass,
    stoppedAtStep: !streamPass ? "stream" : missingSubjects.length > 0 ? "subjects" : !zscorePass ? "zscore" : null,
    steps: [
      {
        step: "stream",
        status: streamPass ? "pass" : "fail",
        reason: streamPass
          ? `Stream exactly matches official rule: ${parsed.data.stream}`
          : "Stream does not exactly match official eligibility rule.",
      },
      {
        step: "subjects",
        status: missingSubjects.length === 0 ? "pass" : "fail",
        reason:
          missingSubjects.length === 0
            ? "No missing simple subject requirements found."
            : `Missing required subject pass: ${missingSubjects.join(", ")}`,
      },
      {
        step: "rules",
        status: "not_applicable",
        reason: "Complex handbook rules are shown for manual verification and are not guessed.",
      },
      {
        step: "zscore",
        status: zscorePass ? "pass" : "fail",
        reason:
          detail.officialMinimumZScore == null
            ? `No exact official cutoff mapping for ${parsed.data.district}.`
            : `Official cutoff for ${parsed.data.district}: ${detail.officialMinimumZScore}`,
      },
    ],
    estimate:
      detail.officialMinimumZScore == null
        ? null
        : {
            hasSufficientData: true,
            historicalCutoffs: detail.cutoffHistory,
            weightedEstimate: detail.officialMinimumZScore,
            rangeLow: detail.officialMinimumZScore,
            rangeHigh: detail.officialMinimumZScore,
            confidence: "High",
            statusLabel: zscorePass ? "competitive_range" : "below_recent_range",
          },
  });
});

export default router;
