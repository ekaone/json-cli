import OpenAI from "openai";
import type { AIProvider } from "./types.js";

export function createOpenAIProvider(apiKey?: string): AIProvider {
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });

  return {
    name: "openai",
    async generate(userPrompt, systemPrompt) {
      const response = await client.chat.completions.create({
        model:    "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        max_tokens:      1024,
        response_format: { type: "json_object" }, // enforces JSON output
      });

      const content = response.choices[0]?.message.content;
      if (!content) throw new Error("Empty response from OpenAI");
      return content;
    },
  };
}
