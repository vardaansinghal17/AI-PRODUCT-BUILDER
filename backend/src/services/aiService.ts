import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "AI Product Builder",
  },
});

export async function generateText(prompt: string): Promise<string> {
  try {
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