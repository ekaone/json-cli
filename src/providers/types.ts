export interface AIProvider {
  name: string;
  generate(userPrompt: string, systemPrompt: string): Promise<string>;
}
