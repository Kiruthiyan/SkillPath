import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { usersTable } from "../db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "../api-zod";
import { signToken, requireAuth } from "../middleware/auth";

const router = Router();

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, password, name } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      language: "en",
    })
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      stream: usersTable.stream,
      zscore: usersTable.zscore,
      district: usersTable.district,
      language: usersTable.language,
      role: usersTable.role,
    });

  const token = signToken({ userId: user!.id, email: user!.email });
  res.status(201).json({ token, user: user! });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      stream: user.stream,
      zscore: user.zscore,
      district: user.district,
      language: user.language,
      role: user.role,
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      stream: usersTable.stream,
      zscore: usersTable.zscore,
      district: usersTable.district,
      language: usersTable.language,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

export default router;
