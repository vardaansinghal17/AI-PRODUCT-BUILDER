import { Router } from "express";
import { buildProject } from "../controllers/buildController";

const router = Router();

router.post("/build", buildProject);

export default router;