import { Router } from "express";
import { AiChatBody } from "../api-zod";
import { generateChatResponse } from "../lib/gemini";
import { aiRateLimiter } from "../middleware/ai";
import { requireActiveSession } from "../middleware/auth";
import { logger } from "../lib/logger";

const router = Router();

router.post("/ai/chat", aiRateLimiter, requireActiveSession, async (req, res) => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { message, context } = parsed.data;

  try {
    const reply = await generateChatResponse(message, context);
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "AI chat error");
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

export default router;
