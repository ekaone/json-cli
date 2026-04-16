import type { AIProvider, TokenUsage } from "./types.js";

export function createOllamaProvider(
  model = "llama3.2",
  baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
): AIProvider {
  return {
    name: `ollama/${model}`,
    async generate(userPrompt, systemPrompt) {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);

      const data = (await response.json()) as {
        message?: { content?: string };
      };
      const content = data?.message?.content;
      if (!content) throw new Error("Empty response from Ollama");

      const usage: TokenUsage = {
        input: 0,
        output: 0,
      };

      return {
        content,
        usage,
      };
    },
  };
}
