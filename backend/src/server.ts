import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import type { Application, Request, Response } from "express";
import testRoute from "./routes/testRoute";
import plannerRoute from "./routes/plannerRoute";


dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("AI Product Builder API is running...");
});


app.use("/api", plannerRoute);
app.use("/api", testRoute);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
