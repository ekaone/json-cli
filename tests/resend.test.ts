import { describe, expect, it } from "vitest";
import {
  buildCatalogMap,
  validateStep,
  type Step,
} from "../src/catalogs/index.js";

describe("resend catalog validation", () => {
  const catalogMap = buildCatalogMap(process.cwd(), ["resend"], "send email");

  it("accepts a valid resend emails send step", () => {
    const step: Step = {
      id: 1,
      type: "resend",
      command: "emails",
      args: [
        "send",
        "--from",
        "no-reply@support.com",
        "--to",
        "ekaone@gmail.com",
        "--subject",
        "Hello from support",
        "--text",
        "How are you?",
      ],
      description: "Send email",
      cwd: null,
    };

    const result = validateStep(step, catalogMap);
    expect(result.valid).toBe(true);
  });

  it("rejects resend emails send step missing required flags", () => {
    const step: Step = {
      id: 1,
      type: "resend",
      command: "emails",
      args: ["send", "--from", "no-reply@support.com", "--to", "ekaone@gmail.com"],
      description: "Missing subject",
      cwd: null,
    };

    const result = validateStep(step, catalogMap);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Missing required flag");
    expect(result.reason).toContain("--subject");
  });

  it("rejects conflicting --html and --text flags", () => {
    const step: Step = {
      id: 1,
      type: "resend",
      command: "emails",
      args: [
        "send",
        "--from",
        "no-reply@support.com",
        "--to",
        "ekaone@gmail.com",
        "--subject",
        "Hello",
        "--html",
        "<p>Hello</p>",
        "--text",
        "Hello",
      ],
      description: "Conflicting content flags",
      cwd: null,
    };

    const result = validateStep(step, catalogMap);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Conflicting flags");
  });

  it("rejects forbidden secret flags", () => {
    const step: Step = {
      id: 1,
      type: "resend",
      command: "emails",
      args: [
        "send",
        "--from",
        "no-reply@support.com",
        "--to",
        "ekaone@gmail.com",
        "--subject",
        "Hello",
        "--text",
        "Hello",
        "--api-key",
        "re_1234567890abcdef",
      ],
      description: "Includes forbidden api key arg",
      cwd: null,
    };

    const result = validateStep(step, catalogMap);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Forbidden flag");
  });
});
