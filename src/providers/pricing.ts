import type { ProviderName } from "./index.js";

export const PRICING = {
  claude: { input: 3.0, output: 15.0 }, // per 1M tokens
  openai: { input: 2.5, output: 10.0 },
  ollama: { input: 0, output: 0 }, // local, free
} as const;

export function calculateCost(
  provider: ProviderName,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = PRICING[provider];
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return inputCost + outputCost;
}

export function formatCost(cost: number): string {
  if (cost === 0) return "";
  return `~$${cost.toFixed(4)}`;
}
