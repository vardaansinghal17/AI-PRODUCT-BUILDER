import { Request, Response } from "express";
import { plannerAgent } from "../agents/plannerAgent.js";

export async function generatePlan(req: Request, res: Response) {
  try {
    const { idea } = req.body;

    if (!idea) {
      return res.status(400).json({ error: "Idea is required" });
    }

    const plan = await plannerAgent(idea);

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Planner error:", error);
    res.status(500).json({ error: "Failed to generate plan" });
  }
}