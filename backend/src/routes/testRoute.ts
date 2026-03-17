import { Router } from "express";
import { generateText } from "../services/aiService.js";

const router = Router();

router.get("/test-ai", async (req, res) => {
  try {
    const response = await generateText(
      "Say hello like a senior software engineer"
    );

    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: "AI failed" });
  }
});

export default router;
