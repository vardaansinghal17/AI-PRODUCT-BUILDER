import { generateText } from "../services/aiService";

interface GeneratedFile {
  filename: string;
  code: string;
}

function extractJSON(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("No JSON found");
  }

  return text.substring(start, end + 1);
}

export async function developerAgent(
  task: string,
  context: string
): Promise<GeneratedFile> {
  const prompt = `
You are a TypeScript code generator working inside an existing generated app.

You are working on an existing project.

EXISTING PROJECT FILES:
${context}

TASK:
${task}

CRITICAL RULES:
- Output ONLY valid JSON
- NO explanations
- NO markdown
- ONLY ONE file
- If the file already exists, update it instead of creating a duplicate
- Do NOT create duplicate files
- Use TypeScript
- Use meaningful filenames such as src/index.ts, src/server.ts, package.json, or tsconfig.json
- Return the full file content, not a diff
- Keep imports and scripts consistent with the existing project

FORMAT:
{
  "filename": "src/example.ts",
  "code": "FULL WORKING CODE"
}
`;

  const response = await generateText(prompt);

  try {
    const cleaned = extractJSON(response);
    const parsed: GeneratedFile = JSON.parse(cleaned);

    if (typeof parsed.filename !== "string" || typeof parsed.code !== "string") {
      throw new Error("Developer response is missing filename or code");
    }

    return parsed;
  } catch (error) {
    console.error("Developer parsing error:", response);
    throw new Error("Invalid JSON from developer agent");
  }
}
