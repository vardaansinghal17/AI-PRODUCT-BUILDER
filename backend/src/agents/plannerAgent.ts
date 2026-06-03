import { generateText } from "../services/aiService";
import { parseAIJSONObject } from "../utils/json";

export interface Plan {
  tasks: string[];
}

export async function plannerAgent(
  idea: string,
  existingProjectContext = ""
): Promise<Plan> {
  const prompt = `
You are a senior software architect.

Break the following project idea into coding-only implementation steps for a small, coherent generated project.

Rules:
- Return ONLY coding-related tasks
- Do not include documentation, marketing, deployment, or business steps
- Keep tasks practical, ordered, and implementation-focused
- Each task should be small and actionable
- The tasks must work together as one project, not unrelated components
- Prefer tasks that produce a complete static website structure when the idea is a landing page or website
- Include shared assets and navigation if multiple pages are needed
- Mention concrete target files in the tasks when possible, such as src/index.html, src/about.html, src/contact.html, src/styles.css, or src/app.js
- If an existing project is provided, refine or extend it instead of planning a brand new unrelated app

Return ONLY valid JSON in this format:
{
  "tasks": ["task1", "task2"]
}

EXISTING PROJECT FILES:
${existingProjectContext || "No existing project files."}

Idea:
${idea}
`;

  const response = await generateText(prompt);

  try {
    const parsed = parseAIJSONObject<Plan>(response);

    if (
      !Array.isArray(parsed.tasks) ||
      parsed.tasks.some((task) => typeof task !== "string" || !task.trim())
    ) {
      throw new Error("Planner response must include a valid tasks array");
    }

    return {
      tasks: parsed.tasks.map((task) => task.trim()),
    };
  } catch (error) {
    console.error("Planner parsing error:", response);
    throw new Error("Invalid JSON from planner agent");
  }
}
