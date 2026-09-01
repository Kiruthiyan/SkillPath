import { Router } from "express";
import { db } from "../db";
import {
  alumniReviewsTable,
  universitiesTable,
  coursesTable,
} from "../db";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

router.get("/reviews", async (req, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
  const universityId = req.query.universityId
    ? Number(req.query.universityId)
    : undefined;

  const conditions = [];
  if (courseId) conditions.push(eq(alumniReviewsTable.courseId, courseId));
  if (universityId) conditions.push(eq(alumniReviewsTable.universityId, universityId));

  let query = db
    .select({
      id: alumniReviewsTable.id,
      reviewerName: alumniReviewsTable.reviewerName,
      universityName: universitiesTable.name,
      degreeName: coursesTable.degreeName,
      graduationYear: alumniReviewsTable.graduationYear,
      currentPosition: alumniReviewsTable.currentPosition,
      company: alumniReviewsTable.company,
      reviewText: alumniReviewsTable.reviewText,
      rating: alumniReviewsTable.rating,
      isVerified: alumniReviewsTable.isVerified,
      avatarColor: alumniReviewsTable.avatarColor,
    })
    .from(alumniReviewsTable)
    .leftJoin(universitiesTable, eq(alumniReviewsTable.universityId, universitiesTable.id))
    .leftJoin(coursesTable, eq(alumniReviewsTable.courseId, coursesTable.id))
    .orderBy(desc(alumniReviewsTable.id))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  res.json(await query);
});

export default router;
