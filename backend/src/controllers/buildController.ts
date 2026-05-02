import { Request, Response } from "express";
import { debugAgent } from "../agents/debugAgent";
import { developerAgent } from "../agents/developerAgent";
import { plannerAgent } from "../agents/plannerAgent";
import { AIServiceError } from "../services/aiService";
import { runGeneratedProject } from "../services/executionService";
import {
  ensureGeneratedProjectScaffold,
  getProjectContext,
  resetGeneratedDir,
  writeFile,
} from "../services/fileService";

const MAX_DEBUG_ATTEMPTS = 3;

interface DebugAttemptResult {
  attempt: number;
  fixedFile: string | null;
  success: boolean;
  error: string | null;
  execution: {
    stage: "build" | "run";
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  };
}

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

    resetGeneratedDir();
    ensureGeneratedProjectScaffold();

    const plan = await plannerAgent(idea);
    const generatedFiles: string[] = [];
    const skippedTasks: string[] = [];

    for (const task of plan.tasks) {
      const generatedFile = await developerAgent(task);

      if (!generatedFile) {
        skippedTasks.push(task);
        continue;
      }

      if (!generatedFile.filename.trim()) {
        skippedTasks.push(task);
        continue;
      }

      writeFile(generatedFile.filename, generatedFile.code);
      generatedFiles.push(generatedFile.filename);
    }

    let execution = await runGeneratedProject();
    const debugAttempts: DebugAttemptResult[] = [];

    for (
      let attempt = 1;
      !execution.success && attempt <= MAX_DEBUG_ATTEMPTS;
      attempt += 1
    ) {
      const projectContext = getProjectContext();
      const debuggedFile = await debugAgent(
        execution.stderr || execution.stdout || "Unknown execution failure",
        projectContext
      );

      if (!debuggedFile) {
        debugAttempts.push({
          attempt,
          fixedFile: null,
          success: false,
          error: "Debug agent did not return a valid file.",
          execution: {
            stage: execution.stage,
            stdout: execution.stdout,
            stderr: execution.stderr,
            exitCode: execution.exitCode,
            timedOut: execution.timedOut,
          },
        });
        break;
      }

      writeFile(debuggedFile.filename, debuggedFile.code);

      if (!generatedFiles.includes(debuggedFile.filename)) {
        generatedFiles.push(debuggedFile.filename);
      }

      execution = await runGeneratedProject();
      debugAttempts.push({
        attempt,
        fixedFile: debuggedFile.filename,
        success: execution.success,
        error: null,
        execution: {
          stage: execution.stage,
          stdout: execution.stdout,
          stderr: execution.stderr,
          exitCode: execution.exitCode,
          timedOut: execution.timedOut,
        },
      });
    }

    return res.json({
      success: execution.success,
      plan,
      generatedFiles,
      skippedTasks,
      execution,
      debugAttempts,
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
