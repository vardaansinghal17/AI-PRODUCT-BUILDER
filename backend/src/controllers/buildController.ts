import { Request, Response } from "express";
import { AIServiceError } from "../services/aiService";
import { runBuildPipeline } from "../services/buildService";
import {
  getBuildHistory,
  SessionNotFoundError,
} from "../services/sessionService";

function getIdea(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const maybeIdea = (body as { idea?: unknown }).idea;
  return typeof maybeIdea === "string" ? maybeIdea.trim() : "";
}

function getSessionId(params: Request["params"]): string {
  const rawSessionId = params.sessionId;
  return typeof rawSessionId === "string" ? rawSessionId : "";
}

function handleBuildError(error: unknown, res: Response) {
  console.error("[BUILD] Build error:", error);

  if (error instanceof SessionNotFoundError) {
    return res.status(404).json({
      error: error.message,
    });
  }

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

export async function buildProject(req: Request, res: Response) {
  try {
    const idea = getIdea(req.body);

    if (!idea) {
      return res.status(400).json({ error: "Idea is required" });
    }

    const result = await runBuildPipeline(idea);
    return res.json(result);
  } catch (error) {
    return handleBuildError(error, res);
  }
}

export async function buildProjectStream(req: Request, res: Response) {
  const idea = getIdea(req.body);

  if (!idea) {
    return res.status(400).json({ error: "Idea is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let connectionClosed = false;

  const sendEvent = (type: string, payload: unknown) => {
    if (connectionClosed) {
      return;
    }

    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  req.on("close", () => {
    connectionClosed = true;
  });

  sendEvent("connected", {
    type: "connected",
    message: "Build event stream connected",
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await runBuildPipeline(idea, (event) => {
      sendEvent("progress", event);
    });

    sendEvent("result", result);
    return res.end();
  } catch (error) {
    console.error("[BUILD_STREAM] Build error:", error);

    if (error instanceof SessionNotFoundError) {
      sendEvent("error", {
        error: error.message,
        statusCode: 404,
      });
      return res.end();
    }

    if (error instanceof AIServiceError) {
      sendEvent("error", {
        error: error.message,
        statusCode: error.statusCode,
      });
      return res.end();
    }

    if (error instanceof Error) {
      sendEvent("error", {
        error: error.message,
      });
      return res.end();
    }

    sendEvent("error", {
      error: "Build failed",
    });
    return res.end();
  }
}

export async function refineProject(req: Request, res: Response) {
  try {
    const idea = getIdea(req.body);
    const sessionId = getSessionId(req.params);

    if (!sessionId) {
      return res.status(400).json({ error: "Session id is required" });
    }

    if (!idea) {
      return res.status(400).json({ error: "Idea is required" });
    }

    const result = await runBuildPipeline(idea, undefined, {
      sessionId,
      mode: "refine",
    });

    return res.json(result);
  } catch (error) {
    return handleBuildError(error, res);
  }
}

export async function getProjectBuildHistory(req: Request, res: Response) {
  try {
    const sessionId = getSessionId(req.params);

    if (!sessionId) {
      return res.status(400).json({ error: "Session id is required" });
    }

    const history = getBuildHistory(sessionId);

    return res.json({
      success: true,
      session: history,
    });
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return res.status(404).json({
        error: error.message,
      });
    }

    if (error instanceof Error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: "Failed to load build history",
    });
  }
}
