import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.error(
      `[mailer] SMTP is not configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS) — could not send OTP email to ${to}.`,
    );
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@skillpath.ai";

  try {
    await t.sendMail({
      from,
      to,
      subject: "Your SkillPath AI password reset code",
      text: `Your password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<p>Your password reset code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    });
  } catch (err) {
    console.error(`[mailer] Failed to send OTP email to ${to}:`, err);
  }
}

export async function sendInviteEmail(
  to: string,
  token: string,
  role: "university_admin" | "mentor",
): Promise<void> {
  const t = getTransporter();
  const acceptUrl = `${process.env.APP_BASE_URL || ""}/accept-invite?token=${encodeURIComponent(token)}`;
  const roleLabel = role === "university_admin" ? "University Admin" : "Mentor";

  if (!t) {
    console.error(
      `[mailer] SMTP is not configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS) — could not send ${roleLabel} invite email to ${to}. Accept URL: ${acceptUrl}`,
    );
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@skillpath.ai";

  try {
    await t.sendMail({
      from,
      to,
      subject: `You've been invited to SkillPath AI as a ${roleLabel}`,
      text: `You've been invited to join SkillPath AI as a ${roleLabel}. Accept your invite here: ${acceptUrl}. This link expires in 3 days.`,
      html: `<p>You've been invited to join SkillPath AI as a <strong>${roleLabel}</strong>.</p><p><a href="${acceptUrl}">Accept your invite</a></p><p>This link expires in 3 days.</p>`,
    });
  } catch (err) {
    console.error(`[mailer] Failed to send invite email to ${to}:`, err);
  }
}
