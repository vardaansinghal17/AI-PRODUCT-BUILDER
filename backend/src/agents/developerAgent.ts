import { generateText } from "../services/aiService";

interface GeneratedFile {
  filename: string;
  code: string;
}

function cleanJSON(raw: string): string {
  return raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function developerAgent(task: string): Promise<GeneratedFile> {
  const prompt = `
You are a senior full-stack developer.

Generate code for the following task:

Task: ${task}

Rules:
- Write clean, production-ready code
- Use TypeScript
- Only generate ONE file
- Return ONLY JSON

Format:
{
  "filename": "path/to/file.ts",
  "code": "full code here"
}
`;

  const response = await generateText(prompt);

  try {
    const cleaned = cleanJSON(response);
    const parsed: GeneratedFile = JSON.parse(cleaned);
    return parsed;
  } catch (error) {
    console.error("Developer parsing error:", response);
    throw new Error("Invalid JSON from developer agent");
  }
}