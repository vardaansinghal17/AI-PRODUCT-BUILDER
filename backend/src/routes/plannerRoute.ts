import { Router } from "express";
import { generatePlan } from "../controllers/plannerController";

const router = Router();

router.post("/plan", generatePlan);

export default router;
