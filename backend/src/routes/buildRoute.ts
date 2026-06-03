import { Router } from "express";
import {
  buildProject,
  buildProjectStream,
  getProjectBuildHistory,
  refineProject,
} from "../controllers/buildController";

const router = Router();

router.post("/build/stream", buildProjectStream);
router.post("/build", buildProject);
router.post("/build/:sessionId/refine", refineProject);
router.get("/build/:sessionId/history", getProjectBuildHistory);

export default router;
