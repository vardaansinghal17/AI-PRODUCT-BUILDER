import { Router } from "express";
import { generatePlan } from "../controllers/plannerController.js";

const router = Router();

router.post("/plan", generatePlan);

export default router;