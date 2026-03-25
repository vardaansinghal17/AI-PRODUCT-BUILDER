import { Request, Response } from "express";
import { plannerAgent } from "../agents/plannerAgent";
import { developerAgent } from "../agents/developerAgent";
import { AIServiceError } from "../services/aiService";
import {
  ensureGeneratedProjectScaffold,
  getProjectContext,
  writeFile,
} from "../services/fileService";

export async function buildProject(req: Request, res: Response) {
  try {
    console.log("[BUILD] Incoming request", {
      method: req.method,
      path: req.originalUrl,
      hasBody: Boolean(req.body),
      bodyKeys:
        req.body && typeof req.body === "object" ? Object.keys(req.body) : [],
    });

    const body =
      req.body && typeof req.body === "object"
        ? (req.body as { idea?: unknown })
        : {};
    const idea = typeof body.idea === "string" ? body.idea.trim() : "";

    if (!idea) {
      console.log("[BUILD] Missing idea in request body");
      return res.status(400).json({ error: "Idea is required" });
    }

    console.log("[BUILD] Ensuring generated scaffold");
    ensureGeneratedProjectScaffold();

    console.log("[BUILD] Generating project plan");
    const plan = await plannerAgent(idea);
    const generatedFiles: string[] = [];
    const skippedTasks: string[] = [];

    console.log("[BUILD] Planner result", {
      tasks: plan.tasks,
      taskCount: plan.tasks.length,
    });

    for (const task of plan.tasks) {
      console.log("[BUILD] Processing task", { task });

      const context = getProjectContext();
      console.log("[BUILD] Current project context snapshot", {
        contextLength: context.length,
      });

      const file = await developerAgent(task, context);

      if (!file?.filename || !file?.code) {
        console.log("[BUILD] Invalid file response, skipping task", { task });
        skippedTasks.push(task);
        continue;
      }

      console.log("[BUILD] Writing generated file", {
        filename: file.filename,
        codeLength: file.code.length,
      });
      writeFile(file.filename, file.code);
      generatedFiles.push(file.filename);
    }

    console.log("[BUILD] Finalizing generated scaffold");
    ensureGeneratedProjectScaffold();

    console.log("[BUILD] Build completed", {
      generatedFiles,
      skippedTasks,
    });
    res.json({
      success: true,
      message: "Project generated successfully",
      plan,
      generatedFiles,
      skippedTasks,
    });
  } catch (error) {
    console.error("[BUILD] Build error:", error);

    if (error instanceof AIServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
      });
    }

    if (error instanceof Error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.status(500).json({ error: "Build failed" });
  }
}
