import { describe, expect, it } from "vitest";
import {
  buildCatalogMap,
  validateStep,
  type Step,
} from "../src/catalogs/index.js";

describe("vercel catalog validation", () => {
  const catalogMap = buildCatalogMap(process.cwd(), ["vercel"], "deploy app");

  it("accepts a valid vercel deploy step", () => {
    const step: Step = {
      id: 1,
      type: "vercel",
      command: "deploy",
      args: ["--prod", "--yes"],
      description: "Deploy to production",
      cwd: null,
    };

    const result = validateStep(step, catalogMap);
    expect(result.valid).toBe(true);
  });

  it("rejects invalid top-level vercel command", () => {
    const step: Step = {
      id: 1,
      type: "vercel",
      command: "deploy prod",
      args: [],
      description: "Invalid command format",
      cwd: null,
    };

    const result = validateStep(step, catalogMap);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not an allowed command");
  });

  it("marks deploy as potentially dangerous with warning", () => {
    const step: Step = {
      id: 1,
      type: "vercel",
      command: "deploy",
      args: ["--prod"],
      description: "Deploy to production",
      cwd: null,
    };

    const result = validateStep(step, catalogMap);
    expect(result.valid).toBe(true);
    expect(result.warnings?.[0]).toContain("potentially dangerous");
  });
});
