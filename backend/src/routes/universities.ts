import { Router } from "express";
import { db } from "../db";
import { universitiesTable } from "../db";
import { asc, eq } from "drizzle-orm";

const router = Router();

router.get("/universities", async (_req, res) => {
  const universities = await db
    .select()
    .from(universitiesTable)
    .orderBy(asc(universitiesTable.ranking));
  res.json(universities);
});

router.get("/universities/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [university] = await db
    .select()
    .from(universitiesTable)
    .where(eq(universitiesTable.id, id));

  if (!university) {
    res.status(404).json({ error: "University not found" });
    return;
  }

  res.json(university);
});

export default router;
