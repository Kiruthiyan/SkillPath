import { Router } from "express";
import { db } from "../db";
import { usersTable } from "../db";
import { eq } from "drizzle-orm";
import { UpdateProfileBody } from "../api-zod";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.patch("/users/me", requireAuth, async (req, res) => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.stream !== undefined) updates.stream = parsed.data.stream;
  if (parsed.data.zscore !== undefined) updates.zscore = parsed.data.zscore;
  if (parsed.data.language !== undefined) updates.language = parsed.data.language;
  if (parsed.data.district !== undefined) updates.district = parsed.data.district;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.userId))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      stream: usersTable.stream,
      zscore: usersTable.zscore,
      district: usersTable.district,
      language: usersTable.language,
    });

  res.json(user!);
});

export default router;
