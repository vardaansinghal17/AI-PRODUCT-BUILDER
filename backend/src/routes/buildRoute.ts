import { Router } from "express";
import { buildProject, buildProjectStream } from "../controllers/buildController";

const router = Router();

router.post("/build/stream", buildProjectStream);
router.post("/build", buildProject);

export default router;
