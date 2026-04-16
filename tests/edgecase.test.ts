import { describe, expect, it, vi } from "vitest";
import { generatePlan } from "../src/planner.js";
import { validateStep } from "../src/catalogs/base.js";
import type { AIProvider } from "../src/providers/types.js";
import type { CatalogModule, Step } from "../src/catalogs/index.js";

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

describe("edge cases", () => {
  it("throws on unknown forced catalog", async () => {
    const validPlan = JSON.stringify({
      goal: "test",
      steps: [
        {
          id: 1,
          type: "pnpm",
          command: "test",
          args: [],
          description: "Run tests",
          cwd: null,
        },
      ],
    });

    await expect(
      generatePlan("run tests", mockProviderSequence([validPlan]), false, process.cwd(), [
        "unknown-catalog",
      ]),
    ).rejects.toThrow('Unknown catalog "unknown-catalog"');
  });

  it("fails after repair loop exhaustion", async () => {
    const invalidPlan = JSON.stringify({
      goal: "broken",
      steps: [
        {
          id: 1,
          type: "git",
          command: "not-real-command",
          args: [],
          description: "Invalid command",
          cwd: null,
        },
      ],
    });
    const invalidRepairStep = JSON.stringify({
      id: 1,
      type: "git",
      command: "not-real-command",
      args: [],
      description: "Still invalid after repair",
      cwd: null,
    });

    const provider = mockProviderSequence([
      invalidPlan,
      invalidRepairStep,
      invalidRepairStep,
    ]);

    await expect(generatePlan("do git thing", provider)).rejects.toThrow(
      "Step 1 failed catalog validation",
    );
  });

  it("validateStep rejects unknown step type", () => {
    const step: Step = {
      id: 1,
      type: "madeup",
      command: "run",
      args: [],
      description: "Unknown type",
      cwd: null,
    };

    const catalogMap = new Map<string, CatalogModule>();
    const result = validateStep(step, catalogMap);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unknown type "madeup"');
  });
});
