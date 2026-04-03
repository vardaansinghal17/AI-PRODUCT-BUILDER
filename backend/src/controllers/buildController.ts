import { Request, Response } from "express";
import { developerAgent } from "../agents/developerAgent";
import { plannerAgent } from "../agents/plannerAgent";
import { AIServiceError } from "../services/aiService";
import {
  ensureGeneratedProjectScaffold,
  getProjectContext,
  writeFile,
} from "../services/fileService";

const MAX_TASKS = 5;

function getIdea(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const maybeIdea = (body as { idea?: unknown }).idea;
  return typeof maybeIdea === "string" ? maybeIdea.trim() : "";
}

export async function buildProject(req: Request, res: Response) {
  try {
    const idea = getIdea(req.body);

    if (!idea) {
      return res.status(400).json({ error: "Idea is required" });
    }

    ensureGeneratedProjectScaffold();

    const plan = await plannerAgent(idea);
    const plannedTasks = Array.isArray(plan.tasks) ? plan.tasks.slice(0, MAX_TASKS) : [];
    const generatedFiles = new Set<string>();
    const skippedTasks: string[] = [];

    for (const task of plannedTasks) {
      if (typeof task !== "string" || !task.trim()) {
        skippedTasks.push(String(task));
        continue;
      }

      const context = getProjectContext();
      const generatedFile = await developerAgent(task, context);

      if (!generatedFile) {
        skippedTasks.push(task);
        continue;
      }

      if (!generatedFile.filename.trim()) {
        skippedTasks.push(task);
        continue;
      }

      writeFile(generatedFile.filename, generatedFile.code);
      generatedFiles.add(generatedFile.filename);
    }

    ensureGeneratedProjectScaffold();

    return res.json({
      success: true,
      message: "Project generated successfully",
      plan: {
        tasks: plannedTasks,
      },
      generatedFiles: Array.from(generatedFiles),
      skippedTasks,
    });
  } catch (error) {
    console.error("Build error:", error);

    if (error instanceof AIServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: "Build failed" });
  }
}
