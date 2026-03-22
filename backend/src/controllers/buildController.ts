import { Request, Response } from "express";
import { plannerAgent } from "../agents/plannerAgent";
import { developerAgent } from "../agents/developerAgent";
import { writeFile } from "../services/fileService";

export async function buildProject(req: Request, res: Response) {
  try {
    const { idea } = req.body;

    if (!idea) {
      return res.status(400).json({ error: "Idea is required" });
    }

    // Step 1: Plan
    const plan = await plannerAgent(idea);

    // Step 2: Generate files
    for (const task of plan.tasks) {
      console.log("Processing task:", task);

      const file = await developerAgent(task);

      writeFile(file.filename, file.code);
    }

    res.json({
      success: true,
      message: "Project generated successfully",
    });
  } catch (error) {
    console.error("Build error:", error);
    res.status(500).json({ error: "Build failed" });
  }
}