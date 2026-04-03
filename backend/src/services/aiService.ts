import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

export class AIServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "AIServiceError";
    this.statusCode = statusCode;
  }
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in backend/.env");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "AI Product Builder",
    },
  });
}

export async function generateText(prompt: string): Promise<string> {
  try {
    const client = getClient();

    const response = await client.chat.completions.create({
      model: "openai/gpt-4o-mini", 
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return response.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error("AI Error:", error);

    if (error instanceof Error) {
      throw new AIServiceError(
        `Failed to generate AI response: ${error.message}`
      );
    }

    throw new AIServiceError("Failed to generate AI response");
  }
}
