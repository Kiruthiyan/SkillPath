import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./auth";

/** Rate limit for AI endpoints (Gemini calls). */
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again later." },
});

/** Require auth for AI routes when AI_REQUIRE_AUTH=true (recommended in production). */
export function requireAiAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.AI_REQUIRE_AUTH === "true") {
    requireAuth(req, res, next);
    return;
  }
  next();
}
