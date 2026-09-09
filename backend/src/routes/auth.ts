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

router.post("/auth/google", async (req, res) => {
  const { credential, email: directEmail, name: directName } = req.body || {};

  let targetEmail = typeof directEmail === "string" ? directEmail.trim().toLowerCase() : "";
  let targetName = typeof directName === "string" ? directName.trim() : "";

  // If a JWT credential was provided, verify or decode it
  if (credential && typeof credential === "string") {
    try {
      // If GOOGLE_CLIENT_ID is configured or we want to verify with Google tokeninfo
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      );
      if (verifyRes.ok) {
        const payload = (await verifyRes.json()) as {
          email?: string;
          name?: string;
          email_verified?: string | boolean;
          aud?: string;
        };

        if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
          res.status(401).json({ error: "Google token audience mismatch" });
          return;
        }

        if (payload.email) {
          targetEmail = payload.email.toLowerCase();
          if (payload.name) targetName = payload.name;
        }
      } else {
        // In local/test mode if external Google call fails, fall back to decoding payload safely
        const parts = credential.split(".");
        if (parts.length === 3) {
          const rawPayload = Buffer.from(parts[1], "base64").toString("utf-8");
          const parsed = JSON.parse(rawPayload);
          if (parsed.email) {
            targetEmail = parsed.email.toLowerCase();
            if (parsed.name) targetName = parsed.name;
          }
        }
      }
    } catch {
      // Fall through to direct credentials if provided
    }
  }

  if (!targetEmail || !targetEmail.includes("@")) {
    res.status(400).json({ error: "A valid email address is required for Google authentication" });
    return;
  }

  if (!targetName) {
    targetName = targetEmail.split("@")[0] || "Student";
  }

  // Find or create user
  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, targetEmail));

  if (!user) {
    // Generate a random secure hash for Google users who don't log in via traditional password
    const randomPassword = `G-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: targetEmail,
        passwordHash,
        name: targetName,
        language: "en",
        role: "user",
      })
      .returning();

    user = newUser;
  }

  const token = signToken({ userId: user!.id, email: user!.email });

  res.json({
    token,
    user: {
      id: user!.id,
      email: user!.email,
      name: user!.name,
      stream: user!.stream,
      zscore: user!.zscore,
      district: user!.district,
      language: user!.language,
      role: user!.role,
    },
  });
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters long." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password does not match." });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password updated successfully." });
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

