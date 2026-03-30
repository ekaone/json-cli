export interface TokenUsage {
  input: number;
  output: number;
}

export interface AIProvider {
  name: string;
  generate(
    userPrompt: string,
    systemPrompt: string,
  ): Promise<{
    content: string;
    usage: TokenUsage;
  }>;
}
