export { createClaudeProvider } from "./claude.js";
export { createOpenAIProvider } from "./openai.js";
export { createOllamaProvider } from "./ollama.js";
export type { AIProvider } from "./types.js";

import type { AIProvider } from "./types.js";
import { createClaudeProvider } from "./claude.js";
import { createOpenAIProvider } from "./openai.js";
import { createOllamaProvider } from "./ollama.js";

export type ProviderName = "claude" | "openai" | "ollama";

export function resolveProvider(name: ProviderName): AIProvider {
  switch (name) {
    case "claude":  return createClaudeProvider();
    case "openai":  return createOpenAIProvider();
    case "ollama":  return createOllamaProvider();
    default:        throw new Error(`Unknown provider: ${name}`);
  }
}
