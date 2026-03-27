import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider } from "./types.js";

export function createClaudeProvider(apiKey?: string): AIProvider {
  const client = new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
  });

  return {
    name: "claude",
    async generate(userPrompt, systemPrompt) {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = message.content[0];
      if (block.type !== "text")
        throw new Error("Unexpected response type from Claude");
      return block.text;
    },
  };
}
