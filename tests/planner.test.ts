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

function mockProviderSequence(responses: string[]): AIProvider {
  const queue = [...responses];
  return {
    name: "mock-seq",
    generate: vi.fn().mockImplementation(async () => {
      const content = queue.shift();
      if (!content) throw new Error("No more mocked responses in sequence");
      return {
        content,
        usage: { input: 100, output: 50 },
      };
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
    const provider = mockProviderSequence([hallucinated, hallucinated, hallucinated]);
    await expect(generatePlan("anything", provider)).rejects.toThrow(
      "Repair step failed schema validation",
    );
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

  it("repairs a failing step via targeted repair loop (catalog validation)", async () => {
    const invalidInitialPlan = JSON.stringify({
      goal: "send an email",
      steps: [
        {
          id: 1,
          type: "resend",
          command: "unknown",
          args: [],
          description: "Invalid command",
        },
      ],
    });
    const repairedStep = JSON.stringify({
      id: 1,
      type: "resend",
      command: "login",
      args: [],
      description: "Login to Resend",
      cwd: null,
    });

    const provider = mockProviderSequence([invalidInitialPlan, repairedStep]);
    const result = await generatePlan(
      "send email",
      provider,
      false,
      process.cwd(),
      ["resend"],
    );

    expect(result.plan.steps[0].command).toBe("login");
    expect(result.plan.steps[0].args).toHaveLength(0);
    expect(result.usage.input).toBe(200);
    expect(result.usage.output).toBe(100);
  });

  it("repairs a failing step via targeted repair loop (guardrail)", async () => {
    const invalidInitialPlan = JSON.stringify({
      goal: "commit changes",
      steps: [
        {
          id: 1,
          type: "git",
          command: "commit",
          args: ["-message", "fix: test"],
          description: "Commit changes",
        },
      ],
    });
    const repairedStep = JSON.stringify({
      id: 1,
      type: "git",
      command: "commit",
      args: ["-m", "fix: test"],
      description: "Commit changes",
      cwd: null,
    });

    const provider = mockProviderSequence([invalidInitialPlan, repairedStep]);
    const result = await generatePlan("commit changes", provider);

    expect(result.plan.steps[0].args[0]).toBe("-m");
    expect(result.usage.input).toBe(200);
    expect(result.usage.output).toBe(100);
  });

  it("accepts git diff as a git catalog command", async () => {
    const gitDiffPlan = JSON.stringify({
      goal: "check git diff",
      steps: [
        {
          id: 1,
          type: "git",
          command: "diff",
          args: [],
          description: "Check git diff",
        },
      ],
    });

    const result = await generatePlan("check git diff", mockProvider(gitDiffPlan));
    expect(result.plan.steps[0].type).toBe("git");
    expect(result.plan.steps[0].command).toBe("diff");
  });
});
