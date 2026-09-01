import { Router } from "express";
import {
  getOfficialUniversity,
  listOfficialUniversities,
} from "../db/official-handbook-query";

const router = Router();

router.get("/universities", async (_req, res) => {
  res.json(await listOfficialUniversities());
});

router.get("/universities/:id", async (req, res) => {
  const id = Number(req.params.id);
  const university = await getOfficialUniversity(id);

  if (!university) {
    res.status(404).json({ error: "University not found" });
    return;
  }

  res.json(university);
});

export default router;
