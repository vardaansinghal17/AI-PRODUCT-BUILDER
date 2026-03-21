import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

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
    throw new Error("Failed to generate AI response");
  }
}
