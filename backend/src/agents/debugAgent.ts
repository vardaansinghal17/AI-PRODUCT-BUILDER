import { generateText } from "../services/aiService";
import type { GeneratedFile } from "./developerAgent";

function extractJSON(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return text.substring(start, end + 1);
}

function parseGeneratedFile(response: string): GeneratedFile | null {
  const cleaned = extractJSON(response);

  if (!cleaned) {
    return null;
  }

  try {
    const parsed = JSON.parse(cleaned) as Partial<GeneratedFile>;
    const filename =
      typeof parsed.filename === "string" ? parsed.filename.trim() : "";
    const code = typeof parsed.code === "string" ? parsed.code : "";

    if (!filename || !code.trim()) {
      return null;
    }

    return {
      filename,
      code,
    };
  } catch {
    return null;
  }
}

export async function debugAgent(
  errorLogs: string,
  context: string
): Promise<GeneratedFile | null> {
  const prompt = `
You are a senior TypeScript debugging agent working inside a real existing project.

Analyze the error logs and fix the broken code.

PROJECT CONTEXT:
${context || "No existing generated files yet."}

ERROR LOGS:
${errorLogs}

RULES:
- Return ONLY valid JSON
- Return exactly one file
- Fix the existing file that caused the problem when possible
- Keep the project structure and naming consistent
- Return the full file contents, not a diff
- Do not create duplicate files unless the error clearly requires a missing file

FORMAT:
{
  "filename": "src/example.ts",
  "code": "FULL FILE CONTENT"
}
`;

  const response = await generateText(prompt);
  const parsed = parseGeneratedFile(response);

  if (!parsed) {
    console.warn("Skipping invalid debug response:", response);
    return null;
  }

  return parsed;
}
