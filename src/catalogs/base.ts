import { z } from "zod";

// ---------------------------------------------------------------------------
// Catalog Module Interface
// ---------------------------------------------------------------------------
export interface CatalogModule {
  name: string;
  commands: readonly string[] | ["any"];
  detectors: readonly string[];
  typeEnum: readonly string[];
  buildPrompt(): string;
}

// ---------------------------------------------------------------------------
// Dynamic Zod Schemas
// ---------------------------------------------------------------------------
export function createStepSchema(allTypes: readonly string[]) {
  return z.object({
    id: z.number(),
    type: z.enum(allTypes as [string, ...string[]]),
    command: z.string(),
    args: z.array(z.string()).default([]),
    description: z.string(),
    cwd: z.string().nullable().optional(),
  });
}

export function createPlanSchema(
  stepSchema: ReturnType<typeof createStepSchema>,
) {
  return z.object({
    goal: z.string(),
    steps: z.array(stepSchema).min(1).max(10),
  });
}

// ---------------------------------------------------------------------------
// Types inferred from schemas (will be set dynamically)
// ---------------------------------------------------------------------------
export type Step = {
  id: number;
  type: string;
  command: string;
  args: string[];
  description: string;
  cwd?: string | null;
};

export type Plan = {
  goal: string;
  steps: Step[];
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export function validateStep(
  step: Step,
  catalogMap: Map<string, readonly string[] | ["any"]>,
): { valid: boolean; reason?: string } {
  const allowed = catalogMap.get(step.type);

  if (!allowed) {
    return {
      valid: false,
      reason: `Unknown type "${step.type}"`,
    };
  }

  if (allowed[0] === "any") {
    return { valid: true };
  }

  if (!(allowed as readonly string[]).includes(step.command)) {
    return {
      valid: false,
      reason: `"${step.command}" is not an allowed command for type "${step.type}". Allowed: ${allowed.join(", ")}`,
    };
  }

  return { valid: true };
}
