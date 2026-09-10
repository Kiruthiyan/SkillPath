import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod/v4";
import { db } from "../db";
import { usersTable } from "../db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "../api-zod";
import {
  signToken,
  requireAuth,
  requireActiveSession,
  signPasswordResetToken,
  verifyPasswordResetToken,
  verifyInviteToken,
} from "../middleware/auth";
import { checkNewPassword, PASSWORD_MIN_LENGTH } from "../lib/password-policy";
import { sendOtpEmail } from "../lib/mailer";
import { universityAdminsTable } from "../db";

const router = Router();

function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID environment variable is required");
  return id;
}
const googleClient = new OAuth2Client();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

const registerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again later." },
});

const googleAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const verifyOtpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const acceptInviteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const GENERIC_OTP_REQUEST_MESSAGE =
  "If an account with that email exists, a verification code has been sent.";

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/auth/register", registerRateLimiter, async (req, res) => {
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
      isActive: usersTable.isActive,
      googleId: usersTable.googleId,
      mustChangePassword: usersTable.mustChangePassword,
      tokenVersion: usersTable.tokenVersion,
    });

  const token = signToken({
    userId: user!.id,
    email: user!.email,
    tv: user!.tokenVersion,
  });
  const { googleId, tokenVersion, ...userOut } = user!;
  res.status(201).json({ token, user: { ...userOut, googleLinked: !!googleId } });
});

router.post("/auth/login", loginRateLimiter, async (req, res) => {
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

  if (!user.isActive) {
    res.status(403).json({ error: "This account has been deactivated." });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, tv: user.tokenVersion });
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
      isActive: user.isActive,
      googleLinked: !!user.googleId,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

router.post("/auth/google", googleAuthRateLimiter, async (req, res) => {
  const { credential } = req.body || {};

  if (!credential || typeof credential !== "string") {
    res.status(400).json({ error: "A valid Google credential is required" });
    return;
  }

  let targetEmail = "";
  let targetName = "";
  let googleSub = "";

  try {
    const clientId = getGoogleClientId();
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();

    if (!payload?.email) {
      res.status(400).json({ error: "A valid email address is required for Google authentication" });
      return;
    }

    targetEmail = payload.email.toLowerCase();
    if (payload.name) targetName = payload.name;
    googleSub = payload.sub;
  } catch {
    res.status(401).json({ error: "Could not verify Google credential" });
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
        googleId: googleSub,
      })
      .returning();

    user = newUser;
  } else if (!user.googleId) {
    const [updated] = await db
      .update(usersTable)
      .set({ googleId: googleSub })
      .where(eq(usersTable.id, user.id))
      .returning();
    user = updated;
  }

  if (!user!.isActive) {
    res.status(403).json({ error: "This account has been deactivated." });
    return;
  }

  const token = signToken({ userId: user!.id, email: user!.email, tv: user!.tokenVersion });

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
      isActive: user!.isActive,
      googleLinked: !!user!.googleId,
      mustChangePassword: user!.mustChangePassword,
    },
  });
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

router.post("/auth/change-password", requireActiveSession, async (req, res) => {
  const parsed = ChangePasswordBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Current and new password are both required." });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const policy = checkNewPassword({ newPassword, currentPassword });
  if (!policy.ok) {
    res.status(400).json({ error: policy.message });
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
    // 403, not 401: the session is fine, the submitted form field is wrong.
    // A 401 here would be indistinguishable from an expired session and would
    // sign the user out mid-form.
    res.status(403).json({ error: "Current password is incorrect." });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const [updated] = await db
    .update(usersTable)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      // Invalidates every JWT issued before this change, including the caller's.
      tokenVersion: user.tokenVersion + 1,
    })
    .where(eq(usersTable.id, user.id))
    .returning({ id: usersTable.id });

  if (!updated) {
    res.status(500).json({ error: "Password could not be updated. Please try again." });
    return;
  }

  res.json({
    message: "Password updated successfully. Please sign in again.",
    tokenInvalidated: true,
  });
});

router.get("/auth/me", requireActiveSession, async (req, res) => {
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
      isActive: usersTable.isActive,
      googleId: usersTable.googleId,
      mustChangePassword: usersTable.mustChangePassword,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { googleId, ...userOut } = user;
  res.json({ ...userOut, googleLinked: !!googleId });
});

router.post("/auth/deactivate", requireActiveSession, async (req, res) => {
  await db
    .update(usersTable)
    .set({ isActive: false })
    .where(eq(usersTable.id, req.user!.userId));

  res.json({ message: "Account deactivated." });
});

const DeleteAccountBody = z.object({ password: z.string().optional() });

router.delete("/auth/account", requireActiveSession, async (req, res) => {
  const parsed = DeleteAccountBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
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

  if (!user.googleId) {
    if (!parsed.data.password) {
      res.status(400).json({ error: "Password is required to delete this account." });
      return;
    }
    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Password does not match." });
      return;
    }
  }

  await db.delete(usersTable).where(eq(usersTable.id, user.id));
  res.json({ message: "Account deleted." });
});

const LinkGoogleBody = z.object({ credential: z.string().min(1) });

router.post("/auth/google/link", requireActiveSession, async (req, res) => {
  const parsed = LinkGoogleBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "A valid Google credential is required" });
    return;
  }

  let googleSub = "";
  try {
    const clientId = getGoogleClientId();
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      res.status(401).json({ error: "Could not verify Google credential" });
      return;
    }
    googleSub = payload.sub;
  } catch {
    res.status(401).json({ error: "Could not verify Google credential" });
    return;
  }

  const [conflicting] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.googleId, googleSub));

  if (conflicting && conflicting.id !== req.user!.userId) {
    res.status(409).json({ error: "This Google account is already linked to a different user." });
    return;
  }

  await db
    .update(usersTable)
    .set({ googleId: googleSub })
    .where(eq(usersTable.id, req.user!.userId));

  res.json({ message: "Google account linked." });
});

const ForgotPasswordBody = z.object({ email: z.string().email() });

router.post("/auth/forgot-password", forgotPasswordRateLimiter, async (req, res) => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  const email = parsed.data.email.toLowerCase();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (user) {
    const now = Date.now();
    const requestedAt = user.resetOtpRequestedAt ? new Date(user.resetOtpRequestedAt).getTime() : 0;
    const withinCooldown = now - requestedAt < OTP_RESEND_COOLDOWN_MS;

    if (!withinCooldown) {
      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);

      await db
        .update(usersTable)
        .set({
          resetOtpHash: otpHash,
          resetOtpExpiresAt: new Date(now + OTP_TTL_MS),
          resetOtpAttempts: 0,
          resetOtpRequestedAt: new Date(now),
        })
        .where(eq(usersTable.id, user.id));

      await sendOtpEmail(user.email, otp);
    }
  }

  // Always return the same generic response, whether or not the account exists
  // or a cooldown suppressed sending, to avoid leaking account existence.
  res.json({ message: GENERIC_OTP_REQUEST_MESSAGE });
});

const VerifyResetOtpBody = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(8),
});

router.post("/auth/verify-reset-otp", verifyOtpRateLimiter, async (req, res) => {
  const parsed = VerifyResetOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const { otp } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  const invalidResponse = () => res.status(400).json({ error: "Invalid or expired code" });

  if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
    invalidResponse();
    return;
  }

  if (new Date(user.resetOtpExpiresAt).getTime() < Date.now()) {
    await db
      .update(usersTable)
      .set({ resetOtpHash: null, resetOtpExpiresAt: null, resetOtpAttempts: 0 })
      .where(eq(usersTable.id, user.id));
    invalidResponse();
    return;
  }

  if (user.resetOtpAttempts >= OTP_MAX_ATTEMPTS) {
    await db
      .update(usersTable)
      .set({ resetOtpHash: null, resetOtpExpiresAt: null, resetOtpAttempts: 0 })
      .where(eq(usersTable.id, user.id));
    invalidResponse();
    return;
  }

  const matches = await bcrypt.compare(otp, user.resetOtpHash);
  if (!matches) {
    await db
      .update(usersTable)
      .set({ resetOtpAttempts: user.resetOtpAttempts + 1 })
      .where(eq(usersTable.id, user.id));
    invalidResponse();
    return;
  }

  // OTP is single-use: clear it immediately on successful verification.
  await db
    .update(usersTable)
    .set({ resetOtpHash: null, resetOtpExpiresAt: null, resetOtpAttempts: 0 })
    .where(eq(usersTable.id, user.id));

  const resetToken = signPasswordResetToken(user.id);
  res.json({ resetToken });
});

const ResetPasswordBody = z.object({
  resetToken: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
});

router.post("/auth/reset-password", resetPasswordRateLimiter, async (req, res) => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: `New password must be at least ${PASSWORD_MIN_LENGTH} characters long.` });
    return;
  }

  const policy = checkNewPassword({ newPassword: parsed.data.newPassword });
  if (!policy.ok) {
    res.status(400).json({ error: policy.message });
    return;
  }

  let userId: number;
  try {
    userId = verifyPasswordResetToken(parsed.data.resetToken).userId;
  } catch {
    res.status(401).json({ error: "Invalid or expired reset session. Please request a new code." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Invalid or expired reset session. Please request a new code." });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  const [updated] = await db
    .update(usersTable)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      tokenVersion: user.tokenVersion + 1,
    })
    .where(eq(usersTable.id, user.id))
    .returning({ id: usersTable.id });

  if (!updated) {
    res.status(500).json({ error: "Password could not be reset. Please try again." });
    return;
  }

  res.json({ message: "Password reset successfully." });
});

const AcceptInviteBody = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(PASSWORD_MIN_LENGTH),
});

router.post("/auth/accept-invite", acceptInviteRateLimiter, async (req, res) => {
  const parsed = AcceptInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  let invite;
  try {
    invite = verifyInviteToken(parsed.data.token);
  } catch {
    res.status(401).json({ error: "Invalid or expired invite. Please request a new one." });
    return;
  }

  const email = invite.email.toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(usersTable).where(eq(usersTable.email, email));

    let row = existing;
    if (!row) {
      const [created] = await tx
        .insert(usersTable)
        .values({
          email,
          passwordHash,
          name: parsed.data.name,
          language: "en",
          role: invite.role,
          mustChangePassword: false,
        })
        .returning();
      row = created;
    } else {
      const [updated] = await tx
        .update(usersTable)
        .set({
          role: invite.role,
          passwordHash,
          mustChangePassword: false,
          // Accepting an invite resets the password, so old sessions must die.
          tokenVersion: existing.tokenVersion + 1,
        })
        .where(eq(usersTable.id, existing.id))
        .returning();
      row = updated;
    }

    if (invite.role === "university_admin" && invite.universityId != null) {
      await tx
        .insert(universityAdminsTable)
        .values({ userId: row!.id, universityId: invite.universityId })
        .onConflictDoNothing();
    }

    return row!;
  });

  const token = signToken({ userId: user.id, email: user.email, tv: user.tokenVersion });
  res.status(201).json({
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
      isActive: user.isActive,
      googleLinked: !!user.googleId,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

export default router;

