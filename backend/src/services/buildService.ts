import { debugAgent } from "../agents/debugAgent";
import { developerAgent } from "../agents/developerAgent";
import { plannerAgent } from "../agents/plannerAgent";
import { runGeneratedProject } from "./executionService";
import {
  ensureGeneratedProjectScaffold,
  getProjectContext,
  resetGeneratedDir,
  writeFile,
} from "./fileService";

const MAX_DEBUG_ATTEMPTS = 3;

export interface DebugAttemptResult {
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

export interface BuildPipelineResult {
  success: boolean;
  plan: {
    tasks: string[];
  };
  generatedFiles: string[];
  skippedTasks: string[];
  execution: {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
    stage: "build" | "run";
  };
  debugAttempts: DebugAttemptResult[];
}

export interface BuildProgressEvent {
  type: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

type ProgressCallback = (event: BuildProgressEvent) => void;

function emitProgress(
  onProgress: ProgressCallback | undefined,
  type: string,
  message: string,
  data?: Record<string, unknown>
): void {
  onProgress?.({
    type,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

export async function runBuildPipeline(
  idea: string,
  onProgress?: ProgressCallback
): Promise<BuildPipelineResult> {
  emitProgress(onProgress, "build.started", "Build started", {
    idea,
  });

  resetGeneratedDir();
  ensureGeneratedProjectScaffold();

  emitProgress(onProgress, "planning.started", "Generating implementation plan");
  const plan = await plannerAgent(idea);
  emitProgress(onProgress, "planning.completed", "Plan generated", {
    totalTasks: plan.tasks.length,
    tasks: plan.tasks,
  });

  const generatedFiles: string[] = [];
  const skippedTasks: string[] = [];

  for (const [index, task] of plan.tasks.entries()) {
    emitProgress(onProgress, "generation.task.started", "Generating task file", {
      task,
      taskIndex: index,
      taskNumber: index + 1,
      totalTasks: plan.tasks.length,
    });

    const generatedFile = await developerAgent(task);

    if (!generatedFile || !generatedFile.filename.trim()) {
      skippedTasks.push(task);
      emitProgress(onProgress, "generation.task.skipped", "Task generation skipped", {
        task,
        taskIndex: index,
        taskNumber: index + 1,
        totalTasks: plan.tasks.length,
      });
      continue;
    }

    writeFile(generatedFile.filename, generatedFile.code);
    generatedFiles.push(generatedFile.filename);

    emitProgress(onProgress, "generation.task.completed", "Generated file", {
      task,
      taskIndex: index,
      taskNumber: index + 1,
      totalTasks: plan.tasks.length,
      filename: generatedFile.filename,
    });
  }

  emitProgress(onProgress, "execution.started", "Running generated project", {
    generatedFiles,
    skippedTasks,
  });

  let execution = await runGeneratedProject();
  emitProgress(onProgress, "execution.completed", "Execution finished", {
    success: execution.success,
    stage: execution.stage,
    exitCode: execution.exitCode,
    timedOut: execution.timedOut,
  });

  const debugAttempts: DebugAttemptResult[] = [];

  for (
    let attempt = 1;
    !execution.success && attempt <= MAX_DEBUG_ATTEMPTS;
    attempt += 1
  ) {
    emitProgress(onProgress, "debug.started", "Starting debug attempt", {
      attempt,
      maxAttempts: MAX_DEBUG_ATTEMPTS,
      stage: execution.stage,
    });

    const projectContext = getProjectContext();
    const debuggedFile = await debugAgent(
      execution.stderr || execution.stdout || "Unknown execution failure",
      projectContext
    );

    if (!debuggedFile) {
      const failedAttempt: DebugAttemptResult = {
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
      };

      debugAttempts.push(failedAttempt);
      emitProgress(onProgress, "debug.failed", "Debug attempt did not produce a valid file", {
        attempt,
        maxAttempts: MAX_DEBUG_ATTEMPTS,
        error: failedAttempt.error,
      });
      break;
    }

    writeFile(debuggedFile.filename, debuggedFile.code);

    if (!generatedFiles.includes(debuggedFile.filename)) {
      generatedFiles.push(debuggedFile.filename);
    }

    execution = await runGeneratedProject();

    const debugAttempt: DebugAttemptResult = {
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
    };

    debugAttempts.push(debugAttempt);
    emitProgress(onProgress, "debug.completed", "Debug attempt finished", {
      attempt,
      maxAttempts: MAX_DEBUG_ATTEMPTS,
      fixedFile: debuggedFile.filename,
      success: execution.success,
      stage: execution.stage,
      exitCode: execution.exitCode,
      timedOut: execution.timedOut,
    });
  }

  const result: BuildPipelineResult = {
    success: execution.success,
    plan,
    generatedFiles,
    skippedTasks,
    execution,
    debugAttempts,
  };

  emitProgress(onProgress, "build.completed", "Build pipeline completed", {
    success: result.success,
    generatedFiles: result.generatedFiles,
    skippedTasks: result.skippedTasks,
    debugAttempts: result.debugAttempts.length,
  });

  return result;
}
