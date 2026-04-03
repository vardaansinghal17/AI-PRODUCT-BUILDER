import { Request, Response } from "express";
import { debugAgent } from "../agents/debugAgent";
import { developerAgent } from "../agents/developerAgent";
import { plannerAgent } from "../agents/plannerAgent";
import { AIServiceError } from "../services/aiService";
import { runGeneratedProject } from "../services/executionService";
import {
  ensureGeneratedProjectScaffold,
  getProjectContext,
  writeFile,
} from "../services/fileService";

const MAX_TASKS = 5;
const MAX_DEBUG_RETRIES = 2;

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
      console.log("[BUILD] Missing idea in request body");
      return res.status(400).json({ error: "Idea is required" });
    }

    ensureGeneratedProjectScaffold();

    const plan = await plannerAgent(idea);
    const plannedTasks = Array.isArray(plan.tasks)
      ? plan.tasks.slice(0, MAX_TASKS)
      : [];
    const generatedFiles = new Set<string>();
    const skippedTasks: string[] = [];
    const debuggedTasks: string[] = [];

    for (const task of plannedTasks) {
      if (typeof task !== "string" || !task.trim()) {
        skippedTasks.push(String(task));
        continue;
      }

      console.log("[BUILD] generating...", { task });
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

      let executionResult;
      let retries = 0;

      while (true) {
        console.log("[BUILD] running...", {
          task,
          attempt: retries + 1,
        });
        executionResult = await runGeneratedProject();

        if (executionResult.success) {
          break;
        }

        if (retries >= MAX_DEBUG_RETRIES) {
          console.warn("[BUILD] Max debug retries reached", {
            task,
            stderr: executionResult.stderr,
          });
          skippedTasks.push(task);
          break;
        }

        console.log("[BUILD] fixing error...", {
          task,
          attempt: retries + 1,
          stage: executionResult.stage,
        });

        const debugContext = getProjectContext();
        const combinedLogs = [
          `TASK: ${task}`,
          `STAGE: ${executionResult.stage}`,
          `EXIT CODE: ${executionResult.exitCode ?? "null"}`,
          `STDOUT:`,
          executionResult.stdout || "(empty)",
          `STDERR:`,
          executionResult.stderr || "(empty)",
        ].join("\n");

        const fixedFile = await debugAgent(combinedLogs, debugContext);

        if (!fixedFile || !fixedFile.filename.trim()) {
          console.warn("[BUILD] Debug agent returned invalid fix", { task });
          skippedTasks.push(task);
          break;
        }

        writeFile(fixedFile.filename, fixedFile.code);
        generatedFiles.add(fixedFile.filename);
        debuggedTasks.push(task);
        retries += 1;
      }
    }

    ensureGeneratedProjectScaffold();

    res.json({
      success: true,
      message: "Project generated successfully",
      plan: {
        tasks: plannedTasks,
      },
      generatedFiles: Array.from(generatedFiles),
      debuggedTasks,
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
