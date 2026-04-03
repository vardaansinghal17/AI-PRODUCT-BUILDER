import { spawn } from "child_process";
import path from "path";
import { getGeneratedDir } from "./fileService";

const COMMAND_TIMEOUT_MS = 10_000;
const RUNTIME_TIMEOUT_MS = 4_000;

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  stage: "build" | "run";
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    let timedOut = false;

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeoutHandle);

      if (finished) {
        return;
      }

      finished = true;
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeoutHandle);

      if (finished) {
        return;
      }

      finished = true;
      resolve({
        stdout,
        stderr,
        exitCode,
        timedOut,
      });
    });
  });
}

function getBuildCommand() {
  const backendRoot = path.resolve(__dirname, "../../");
  const tscScript = path.join(
    backendRoot,
    "node_modules",
    "typescript",
    "bin",
    "tsc"
  );
  const generatedDir = getGeneratedDir();
  const generatedTsconfig = path.join(generatedDir, "tsconfig.json");

  return {
    command: process.execPath,
    args: [tscScript, "-p", generatedTsconfig],
    cwd: generatedDir,
  };
}

function getRunCommand() {
  const generatedDir = getGeneratedDir();
  const entryPoint = path.join(generatedDir, "dist", "index.js");

  return {
    command: process.execPath,
    args: [entryPoint],
    cwd: generatedDir,
  };
}

export async function runGeneratedProject(): Promise<ExecutionResult> {
  const buildCommand = getBuildCommand();
  const buildResult = await runCommand(
    buildCommand.command,
    buildCommand.args,
    buildCommand.cwd,
    COMMAND_TIMEOUT_MS
  );

  if (buildResult.exitCode !== 0 || buildResult.stderr.trim()) {
    return {
      success: false,
      stdout: buildResult.stdout,
      stderr: buildResult.stderr || "Generated project build failed.",
      exitCode: buildResult.exitCode,
      timedOut: buildResult.timedOut,
      stage: "build",
    };
  }

  const runCommandConfig = getRunCommand();
  const runResult = await runCommand(
    runCommandConfig.command,
    runCommandConfig.args,
    runCommandConfig.cwd,
    RUNTIME_TIMEOUT_MS
  );

  const runtimeSucceeded =
    runResult.timedOut || (runResult.exitCode === 0 && !runResult.stderr.trim());

  return {
    success: runtimeSucceeded,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    exitCode: runResult.exitCode,
    timedOut: runResult.timedOut,
    stage: "run",
  };
}
