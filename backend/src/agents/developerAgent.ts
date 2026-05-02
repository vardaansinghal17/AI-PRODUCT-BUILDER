import { generateText } from "../services/aiService";
import { getProjectContext } from "../services/fileService";
import { parseAIJSONObject } from "../utils/json";

export interface GeneratedFile {
  filename: string;
  code: string;
}

function parseGeneratedFile(response: string): GeneratedFile | null {
  try {
    const parsed = parseAIJSONObject<Partial<GeneratedFile>>(response);
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

export async function developerAgent(task: string): Promise<GeneratedFile | null> {
  const existingProjectContext = getProjectContext();
  const prompt = `
You are a senior TypeScript engineer.

Implement exactly one coding task by returning exactly one file.

TASK:
${task}

EXISTING PROJECT FILES:
${existingProjectContext || "No generated files yet."}

RULES:
- Return ONLY valid JSON
- Only ONE file per task
- No explanations
- No markdown
- Return the full file contents, not a diff
- Use a meaningful relative filename like src/index.ts or package.json
- The file must stay consistent with the existing project files
- If you create or update HTML, include links to the other relevant pages when appropriate
- If HTML references CSS or JS assets, use paths that actually match files in the project
- For landing pages or static sites, prefer plain HTML/CSS/JS files over unrelated TypeScript/React files unless the existing project already uses them
- Avoid placeholder content like "sample page", "your company", or empty sections

FORMAT:
{
  "filename": "src/file.ts",
  "code": "..."
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
