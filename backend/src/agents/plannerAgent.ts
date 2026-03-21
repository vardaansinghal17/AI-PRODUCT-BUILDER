import { generateText } from "../services/aiService";

interface Plan {
  tasks: string[];
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
    const parsed: Plan = JSON.parse(response);
    return parsed;
  } catch (error) {
    console.error("Planner parsing error:", response);
    throw new Error("Invalid JSON from planner agent");
  }
}
