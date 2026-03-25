import { generateText } from "../services/aiService";

interface Plan {
  tasks: string[];
}

function extractJSON(raw: string): string {
  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("No JSON found in planner response");
  }

  return cleaned.substring(start, end + 1);
}

export async function plannerAgent(idea: string): Promise<Plan> {
  const prompt = `
You are a senior software architect.

Break the following project idea into clear development steps.

Rules:
- Keep steps practical and ordered
- Each step should be small and actionable
- Focus on full-stack web development

Return ONLY valid JSON in this format:
{
  "tasks": ["step1", "step2", "step3"]
}

Idea:
${idea}
`;

  const response = await generateText(prompt);

  try {
    const parsed: Plan = JSON.parse(extractJSON(response));

    if (!Array.isArray(parsed.tasks)) {
      throw new Error("Planner response must include a tasks array");
    }

    return parsed;
  } catch (error) {
    console.error("Planner parsing error:", response);
    throw new Error("Invalid JSON from planner agent");
  }
}
