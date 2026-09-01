import { Router } from "express";
import { db } from "../db";
import { degreeProgrammesTable, universitiesTable, roadmapsTable } from "../db";
import { eq } from "drizzle-orm";
import { GenerateRoadmapBody } from "../api-zod";
import { optionalAuth } from "../middleware/auth";
import { aiRateLimiter, requireAiAuth } from "../middleware/ai";
import { generateRoadmapWithAI } from "../lib/gemini";

const router = Router();

const ROADMAPS: Record<
  string,
  {
    years: Array<{ year: number; milestones: string[] }>;
    afterGraduation: Array<{ timeframe: string; role: string }>;
  }
> = {
  IT: {
    years: [
      {
        year: 1,
        milestones: [
          "Programming fundamentals in Python and Java",
          "Mathematics for computing",
          "Introduction to web development",
        ],
      },
      {
        year: 2,
        milestones: [
          "Database systems and SQL",
          "Data structures and algorithms",
          "Object-oriented programming projects",
        ],
      },
      {
        year: 3,
        milestones: [
          "Industry internship (3-6 months)",
          "Cloud computing fundamentals (AWS/Azure)",
          "Build portfolio projects",
        ],
      },
      {
        year: 4,
        milestones: [
          "Final year research project",
          "System design and architecture",
          "Job applications and interviews",
        ],
      },
    ],
    afterGraduation: [
      { timeframe: "After Graduation", role: "Junior Software Engineer" },
      { timeframe: "3 Years Later", role: "Software Engineer" },
      { timeframe: "5 Years Later", role: "Senior Software Engineer" },
      { timeframe: "10 Years Later", role: "Technical Lead / Engineering Manager" },
    ],
  },
  Engineering: {
    years: [
      {
        year: 1,
        milestones: [
          "Engineering mathematics and physics",
          "Engineering drawing and design",
          "Introduction to materials science",
        ],
      },
      {
        year: 2,
        milestones: [
          "Core engineering principles",
          "CAD software proficiency",
          "Laboratory work and experiments",
        ],
      },
      {
        year: 3,
        milestones: [
          "Specialization subjects",
          "Industry training",
          "Technical project work",
        ],
      },
      {
        year: 4,
        milestones: [
          "Final year design project",
          "Professional engineering ethics",
          "Interview preparation",
        ],
      },
    ],
    afterGraduation: [
      { timeframe: "After Graduation", role: "Graduate Engineer" },
      { timeframe: "3 Years Later", role: "Engineer" },
      { timeframe: "5 Years Later", role: "Senior Engineer" },
      { timeframe: "10 Years Later", role: "Principal Engineer / Engineering Director" },
    ],
  },
  Management: {
    years: [
      {
        year: 1,
        milestones: [
          "Business fundamentals and economics",
          "Accounting and finance basics",
          "Communication and presentation skills",
        ],
      },
      {
        year: 2,
        milestones: [
          "Marketing and operations management",
          "Human resource management",
          "Business statistics",
        ],
      },
      {
        year: 3,
        milestones: [
          "Strategic management",
          "Internship in a corporate setting",
          "Professional certifications (CIMA/ACCA foundation)",
        ],
      },
    ],
    afterGraduation: [
      { timeframe: "After Graduation", role: "Management Trainee" },
      { timeframe: "3 Years Later", role: "Executive / Analyst" },
      { timeframe: "5 Years Later", role: "Senior Manager" },
      { timeframe: "10 Years Later", role: "Director / General Manager" },
    ],
  },
  Science: {
    years: [
      {
        year: 1,
        milestones: [
          "Core science subjects",
          "Laboratory techniques",
          "Scientific writing and research methods",
        ],
      },
      {
        year: 2,
        milestones: [
          "Advanced laboratory work",
          "Statistics for science",
          "Research project design",
        ],
      },
      {
        year: 3,
        milestones: [
          "Specialization in chosen field",
          "Industry or academic internship",
          "Research thesis planning",
        ],
      },
    ],
    afterGraduation: [
      { timeframe: "After Graduation", role: "Research Assistant / Lab Technician" },
      { timeframe: "3 Years Later", role: "Research Scientist" },
      { timeframe: "5 Years Later", role: "Senior Researcher" },
      { timeframe: "10 Years Later", role: "Principal Scientist / Head of Research" },
    ],
  },
};

function getTemplateRoadmap(degreeType: string) {
  if (degreeType in ROADMAPS) return ROADMAPS[degreeType]!;
  if (degreeType.toLowerCase().includes("it") || degreeType.toLowerCase().includes("computing"))
    return ROADMAPS.IT!;
  if (degreeType.toLowerCase().includes("engineer")) return ROADMAPS.Engineering!;
  if (degreeType.toLowerCase().includes("manage") || degreeType.toLowerCase().includes("business"))
    return ROADMAPS.Management!;
  return ROADMAPS.Science!;
}

router.post("/roadmaps/generate", aiRateLimiter, requireAiAuth, optionalAuth, async (req, res) => {
  const parsed = GenerateRoadmapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { courseId, stream, zscore } = parsed.data;

  const [courseRow] = await db
    .select({
      degreeName: degreeProgrammesTable.degreeName,
      durationYears: degreeProgrammesTable.durationYears,
      degreeType: degreeProgrammesTable.degreeType,
      faculty: degreeProgrammesTable.faculty,
      universityName: universitiesTable.name,
    })
    .from(degreeProgrammesTable)
    .leftJoin(
      universitiesTable,
      eq(degreeProgrammesTable.universityId, universitiesTable.id),
    )
    .where(eq(degreeProgrammesTable.id, courseId));

  if (!courseRow) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  let years: Array<{ year: number; milestones: string[] }>;
  let afterGraduation: Array<{ timeframe: string; role: string }>;

  const aiRoadmap = await generateRoadmapWithAI({
    degreeName: courseRow.degreeName,
    degreeType: courseRow.degreeType,
    faculty: courseRow.faculty,
    universityName: courseRow.universityName ?? "",
    durationYears: courseRow.durationYears,
    stream,
    zscore,
  });

  if (aiRoadmap) {
    years = aiRoadmap.years.slice(0, courseRow.durationYears);
    afterGraduation = aiRoadmap.afterGraduation;
  } else {
    const template = getTemplateRoadmap(courseRow.degreeType);
    years = template.years.slice(0, courseRow.durationYears).map((y, i) => ({
      year: i + 1,
      milestones: y.milestones,
    }));
    afterGraduation = template.afterGraduation;
  }

  while (years.length < courseRow.durationYears) {
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

  if (req.user) {
    await db.insert(roadmapsTable).values({
      userId: req.user.userId,
      courseId,
      content: JSON.stringify(result),
    });
  }

  res.json(result);
});

export default router;
