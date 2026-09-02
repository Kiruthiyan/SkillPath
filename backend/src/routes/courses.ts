import { Router } from "express";
import {
  getOfficialCourseDetail,
  listOfficialCourses,
} from "../db/official-handbook-query";

const router = Router();

router.get("/courses", async (req, res) => {
  const stream = req.query.stream as string | undefined;
  const zscore = req.query.zscore ? Number(req.query.zscore) : undefined;
  const universityId = req.query.universityId ? Number(req.query.universityId) : undefined;
  const faculty = req.query.faculty as string | undefined;
  const medium = req.query.medium as string | undefined;
  const district = (req.query.district as string | undefined) ?? "All Island";
  const academicYear = req.query.academicYear as string | undefined;

  if (zscore != null && !Number.isNaN(zscore) && !req.query.district) {
    res.status(400).json({
      error: "district is required when filtering by zscore",
    });
    return;
  }

  const courses = await listOfficialCourses({
    stream,
    zscore,
    universityId,
    faculty,
    medium,
    district,
    academicYear,
  });

  res.json(courses);
});

router.get("/courses/:id/prediction-insight", async (req, res) => {
  const id = Number(req.params.id);
  const district = (req.query.district as string | undefined) ?? "All Island";
  const zscore = req.query.zscore ? Number(req.query.zscore) : undefined;
  const course = await getOfficialCourseDetail(id, { district });

  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  res.json({
    programme: {
      id: course.id,
      degreeName: course.degreeName,
      universityName: course.universityName,
      stream: course.stream ?? "",
      faculty: course.faculty ?? "",
    },
    district,
    studentZscore: zscore != null && !Number.isNaN(zscore) ? zscore : null,
    history: course.cutoffHistory,
    historyByDistrict: { [district]: course.cutoffHistory },
    prediction: {
      officialCutoff: course.officialMinimumZScore,
      officialAcademicYear: course.officialAcademicYear,
      predictedCutoff: null,
      predictedAcademicYear: null,
      confidence: course.officialMinimumZScore == null ? "Low" : "High",
      dataSource: "official_handbook_2025",
      yearOverYearDeltas: [],
    },
    eligibility: course.eligibility,
    handbookAttribution: "Data from official handbook-derived local 2025/2026 records.",
    explanation:
      "This view uses exact official handbook-derived course and cutoff mappings only. No predicted cutoff is generated for normalized 2025/2026 handbook records.",
  });
});

router.get("/courses/:id", async (req, res) => {
  const id = Number(req.params.id);
  const district = (req.query.district as string | undefined) ?? "All Island";
  const academicYear = req.query.academicYear as string | undefined;

  const row = await getOfficialCourseDetail(id, { district, academicYear });

  if (!row) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  res.json(row);
});

router.get("/courses/:id/careers", async (req, res) => {
  const id = Number(req.params.id);
  const course = await getOfficialCourseDetail(id, {});

  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  res.json([]);
});

export default router;
