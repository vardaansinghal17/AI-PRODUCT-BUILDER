import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import type { Application, NextFunction, Request, Response } from "express";
import testRoute from "./routes/testRoute";
import plannerRoute from "./routes/plannerRoute";
import buildRoute from "./routes/buildRoute";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  console.log(`[HTTP] ${req.method} ${req.originalUrl}`, {
    contentType: req.headers["content-type"],
  });

  res.on("finish", () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

app.get("/", (req: Request, res: Response) => {
  res.send("AI Product Builder API is running...");
});


app.use("/api", plannerRoute);
app.use("/api", testRoute);
app.use("/api", buildRoute);


app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    console.error("[HTTP] Invalid JSON body", {
      path: req.originalUrl,
      message: err.message,
    });
    return res.status(400).json({
      error: "Invalid JSON body",
    });
  }

  return next(err);
});

app.use((req: Request, res: Response) => {
  console.log("[HTTP] Route not found", {
    method: req.method,
    path: req.originalUrl,
  });
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("[HTTP] Available endpoints", {
    root: `http://localhost:${PORT}/`,
    testAI: `http://localhost:${PORT}/api/test-ai`,
    plan: `http://localhost:${PORT}/api/plan`,
    build: `http://localhost:${PORT}/api/build`,
    buildV1: `http://localhost:${PORT}/api/v1/build`,
  });
});
