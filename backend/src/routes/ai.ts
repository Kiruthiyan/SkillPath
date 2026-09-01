import { Router } from "express";
import { AiChatBody } from "../api-zod";
import { generateChatResponse } from "../lib/gemini";
import { aiRateLimiter, requireAiAuth } from "../middleware/ai";

const router = Router();

router.post("/ai/chat", aiRateLimiter, requireAiAuth, async (req, res) => {
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
    console.error("AI chat error:", err);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

export default router;
