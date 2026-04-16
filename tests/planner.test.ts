import { describe, it, expect, vi } from "vitest";
import { generatePlan } from "../src/planner.js";
import type { AIProvider } from "../src/providers/types.js";

// ---------------------------------------------------------------------------
// Mock provider factory
// ---------------------------------------------------------------------------
function mockProvider(response: string): AIProvider {
  return {
    name: "mock",
    generate: vi.fn().mockResolvedValue({
      content: response,
      usage: { input: 100, output: 50 },
    }),
  };
}

// ---------------------------------------------------------------------------
// Valid plan fixture
// ---------------------------------------------------------------------------
const validPlan = JSON.stringify({
  goal: "install deps and run tests",
  steps: [
    {
      id: 1,
      type: "pnpm",
      command: "install",
      args: [],
      description: "Install dependencies",
    },
    {
      id: 2,
      type: "pnpm",
      command: "test",
      args: ["--run"],
      description: "Run tests",
    },
  ],
});

describe("generatePlan", () => {
  it("parses a valid plan", async () => {
    const result = await generatePlan(
      "install and test",
      mockProvider(validPlan),
    );
    expect(result.plan.steps).toHaveLength(2);
    expect(result.plan.steps[0].type).toBe("pnpm");
    expect(result.plan.steps[0].command).toBe("install");
    expect(result.usage.input).toBe(100);
    expect(result.usage.output).toBe(50);
  });

  it("strips markdown fences from response", async () => {
    const wrapped = "```json\n" + validPlan + "\n```";
    const result = await generatePlan(
      "install and test",
      mockProvider(wrapped),
    );
    expect(result.plan.steps).toHaveLength(2);
  });

  it("throws on invalid JSON", async () => {
    await expect(
      generatePlan("anything", mockProvider("not json at all")),
    ).rejects.toThrow("invalid JSON");
  });

  it("throws on schema mismatch", async () => {
    const bad = JSON.stringify({
      goal: "test",
      steps: [{ id: 1, type: "pnpm" }],
    });
    await expect(generatePlan("anything", mockProvider(bad))).rejects.toThrow(
      "schema validation",
    );
  });

  it("throws on hallucinated command not in catalog", async () => {
    const hallucinated = JSON.stringify({
      goal: "nuke everything",
      steps: [
        {
          id: 1,
          type: "pnpm",
          command: "nuke",
          args: ["--force"],
          description: "Nuke",
        },
      ],
    });
    await expect(
      generatePlan("anything", mockProvider(hallucinated)),
    ).rejects.toThrow("catalog validation");
  });

  it("normalizes combined command token into command + args", async () => {
    const resendCombined = JSON.stringify({
      goal: "send an email",
      steps: [
        {
          id: 1,
          type: "resend",
          command: "emails send",
          args: [
            "--from",
            "no-reply@support.com",
            "--to",
            "ekaone@gmail.com",
            "--subject",
            "Hello, this is support team",
            "--text",
            "how are you",
          ],
          description: "Send email",
        },
      ],
    });

    const result = await generatePlan(
      "send email",
      mockProvider(resendCombined),
      false,
      process.cwd(),
      ["resend"],
    );

    expect(result.plan.steps[0].command).toBe("emails");
    expect(result.plan.steps[0].args[0]).toBe("send");
  });
});
