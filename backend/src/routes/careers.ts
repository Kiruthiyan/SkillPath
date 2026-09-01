import { Router } from "express";
import { db } from "../db";
import { careerPathsTable } from "../db";
import { asc, eq } from "drizzle-orm";

const router = Router();

router.get("/careers", async (req, res) => {
  const degreeType = req.query.degreeType as string | undefined;

  let query = db.select().from(careerPathsTable).orderBy(asc(careerPathsTable.title)).$dynamic();

  if (degreeType) {
    query = query.where(eq(careerPathsTable.degreeType, degreeType));
  }

  res.json(await query);
});

export default router;
