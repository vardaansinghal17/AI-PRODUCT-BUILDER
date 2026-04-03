import { generateText } from "../services/aiService";

export interface GeneratedFile {
  filename: string;
  code: string;
}

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

export async function developerAgent(
  task: string,
  context: string
): Promise<GeneratedFile | null> {
  const prompt = `
You are a senior TypeScript engineer working inside a real existing project.

Your job is to make one clean project change for the task below while staying consistent with the current codebase.

PROJECT CONTEXT:
${context || "No existing generated files yet."}

TASK:
${task}

RULES:
- Return ONLY valid JSON
- Return exactly one file
- Update an existing file when appropriate instead of creating duplicates
- Never invent duplicate filenames for the same responsibility
- Maintain consistency with current imports, scripts, file structure, and naming
- Return the full file contents, not a diff
- Use a meaningful relative filename like src/index.ts or package.json

FORMAT:
{
  "filename": "src/example.ts",
  "code": "FULL FILE CONTENT"
}
`;

  const response = await generateText(prompt);
  const parsed = parseGeneratedFile(response);

  if (!parsed) {
    console.warn("Skipping invalid developer response:", response);
    return null;
  }

  return parsed;
}
