import { Router } from "express";
import { db } from "../db";
import {
  successStoriesTable,
  coursesTable,
  universitiesTable,
} from "../db";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/stories", async (req, res) => {
  const degreeType = req.query.degreeType as string | undefined;

  let query = db
    .select({
      id: successStoriesTable.id,
      name: successStoriesTable.name,
      degreeName: coursesTable.degreeName,
      universityName: universitiesTable.name,
      graduationYear: successStoriesTable.graduationYear,
      currentPosition: successStoriesTable.currentPosition,
      summary: successStoriesTable.summary,
      careerJourney: successStoriesTable.careerJourney,
      avatarColor: successStoriesTable.avatarColor,
      degreeType: coursesTable.degreeType,
    })
    .from(successStoriesTable)
    .leftJoin(coursesTable, eq(successStoriesTable.courseId, coursesTable.id))
    .leftJoin(universitiesTable, eq(coursesTable.universityId, universitiesTable.id))
    .orderBy(desc(successStoriesTable.id))
    .$dynamic();

  if (degreeType) {
    query = query.where(eq(coursesTable.degreeType, degreeType));
  }

  const stories = await query;
  res.json(
    stories.map((s) => ({
      id: s.id,
      name: s.name,
      degreeName: s.degreeName,
      universityName: s.universityName,
      graduationYear: s.graduationYear,
      currentPosition: s.currentPosition,
      summary: s.summary,
      careerJourney: s.careerJourney ? JSON.parse(s.careerJourney) : [],
      avatarColor: s.avatarColor,
    })),
  );
});

router.get("/stories/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({
      id: successStoriesTable.id,
      name: successStoriesTable.name,
      degreeName: coursesTable.degreeName,
      universityName: universitiesTable.name,
      graduationYear: successStoriesTable.graduationYear,
      currentPosition: successStoriesTable.currentPosition,
      summary: successStoriesTable.summary,
      careerJourney: successStoriesTable.careerJourney,
      avatarColor: successStoriesTable.avatarColor,
    })
    .from(successStoriesTable)
    .leftJoin(coursesTable, eq(successStoriesTable.courseId, coursesTable.id))
    .leftJoin(universitiesTable, eq(coursesTable.universityId, universitiesTable.id))
    .where(eq(successStoriesTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Story not found" });
    return;
  }

  res.json({
    ...row,
    careerJourney: row.careerJourney ? JSON.parse(row.careerJourney) : [],
  });
});

export default router;
