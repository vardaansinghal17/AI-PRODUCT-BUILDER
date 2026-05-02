export function extractJSONObject(raw: string): string {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in AI response");
  }

  return cleaned.substring(start, end + 1);
}

export function parseAIJSONObject<T>(raw: string): T {
  return JSON.parse(extractJSONObject(raw)) as T;
}
