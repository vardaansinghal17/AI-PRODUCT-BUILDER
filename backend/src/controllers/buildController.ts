import { Request, Response } from "express";
import { AIServiceError } from "../services/aiService";
import { runBuildPipeline } from "../services/buildService";

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

    const result = await runBuildPipeline(idea);
    return res.json(result);
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
