import { describe, expect, it } from "vitest";
import { applyGuardrails } from "../src/guardrails.js";
import type { Step } from "../src/catalogs/index.js";

describe("applyGuardrails flag checks", () => {
  it("allows valid short flags such as git commit -m", () => {
    const steps: Step[] = [
      {
        id: 1,
        type: "git",
        command: "commit",
        args: ["-m", "fix: catalog types"],
        description: "Commit changes",
      },
    ];

    const result = applyGuardrails(steps);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects malformed single-dash long flags", () => {
    const steps: Step[] = [
      {
        id: 1,
        type: "git",
        command: "commit",
        args: ["-message", "fix: catalog types"],
        description: "Commit changes",
      },
    ];

    const result = applyGuardrails(steps);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("malformed single-dash flag");
  });
});
