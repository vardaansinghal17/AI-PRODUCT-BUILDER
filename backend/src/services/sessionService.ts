import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getGeneratedDir, resetGeneratedDir } from "./fileService";
import type { BaseBuildPipelineResult } from "./buildService";

const SESSIONS_DIR = path.resolve(__dirname, "../../sessions");

export interface SessionBuildRecord extends BaseBuildPipelineResult {
  buildNumber: number;
  idea: string;
  mode: "new" | "refine";
  createdAt: string;
  snapshotPath: string;
}

export interface BuildSession {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  latestBuildNumber: number | null;
  builds: SessionBuildRecord[];
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Build session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

function ensureSessionsDir(): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function validateSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();

  if (!/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
    throw new Error("Invalid session id");
  }

  return trimmed;
}

function getSessionDir(sessionId: string): string {
  ensureSessionsDir();
  const safeSessionId = validateSessionId(sessionId);
  const sessionDir = path.resolve(SESSIONS_DIR, safeSessionId);

  if (!sessionDir.startsWith(SESSIONS_DIR)) {
    throw new Error("Invalid session path");
  }

  return sessionDir;
}

function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionDir(sessionId), "session.json");
}

function getBuildSnapshotDir(sessionId: string, buildNumber: number): string {
  return path.join(
    getSessionDir(sessionId),
    "builds",
    `build-${String(buildNumber).padStart(4, "0")}`,
    "project"
  );
}

function writeSession(session: BuildSession): void {
  const sessionFilePath = getSessionFilePath(session.sessionId);
  fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
  fs.writeFileSync(sessionFilePath, `${JSON.stringify(session, null, 2)}\n`, "utf-8");
}

export function createBuildSession(): BuildSession {
  const now = new Date().toISOString();
  const session: BuildSession = {
    sessionId: randomUUID(),
    createdAt: now,
    updatedAt: now,
    latestBuildNumber: null,
    builds: [],
  };

  writeSession(session);
  return session;
}

export function getBuildSession(sessionId: string): BuildSession | null {
  const sessionFilePath = getSessionFilePath(sessionId);

  if (!fs.existsSync(sessionFilePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(sessionFilePath, "utf-8")) as BuildSession;
}

export function requireBuildSession(sessionId: string): BuildSession {
  const session = getBuildSession(sessionId);

  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }

  return session;
}

export function restoreLatestBuildSnapshot(sessionId: string): BuildSession {
  const session = requireBuildSession(sessionId);
  resetGeneratedDir();

  if (session.latestBuildNumber === null) {
    return session;
  }

  const snapshotDir = getBuildSnapshotDir(sessionId, session.latestBuildNumber);

  if (!fs.existsSync(snapshotDir)) {
    throw new Error(`Snapshot missing for build ${session.latestBuildNumber}`);
  }

  fs.cpSync(snapshotDir, getGeneratedDir(), { recursive: true });
  return session;
}

export function saveBuildToSession(
  sessionId: string,
  idea: string,
  mode: "new" | "refine",
  result: BaseBuildPipelineResult
): SessionBuildRecord {
  const session = requireBuildSession(sessionId);
  const buildNumber = session.builds.length + 1;
  const snapshotDir = getBuildSnapshotDir(sessionId, buildNumber);

  fs.rmSync(snapshotDir, { recursive: true, force: true });
  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.cpSync(getGeneratedDir(), snapshotDir, { recursive: true });

  const record: SessionBuildRecord = {
    ...result,
    buildNumber,
    idea,
    mode,
    createdAt: new Date().toISOString(),
    snapshotPath: path.relative(getSessionDir(sessionId), snapshotDir).replace(/\\/g, "/"),
  };

  session.builds.push(record);
  session.latestBuildNumber = buildNumber;
  session.updatedAt = record.createdAt;

  writeSession(session);
  return record;
}

export function getBuildHistory(sessionId: string): BuildSession {
  return requireBuildSession(sessionId);
}
