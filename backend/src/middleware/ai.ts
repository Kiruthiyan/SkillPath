import rateLimit from "express-rate-limit";

/** Rate limit for AI endpoints (Gemini calls). */
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again later." },
});
