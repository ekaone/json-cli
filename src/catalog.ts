import { z } from "zod";

// ---------------------------------------------------------------------------
// Allowed commands per type — the whitelist that prevents hallucination
// ---------------------------------------------------------------------------
export const CATALOG = {
  npm: ["install", "run", "build", "test", "publish", "ci"],
  pnpm: ["install", "run", "build", "test", "publish", "add", "remove"],
  yarn: ["install", "run", "build", "test", "publish", "add", "remove"],
  bun: ["install", "run", "build", "test", "publish", "add", "remove"],
  git: [
    "init",
    "add",
    "commit",
    "push",
    "pull",
    "clone",
    "status",
    "log",
    "branch",
    "checkout",
    "merge",
    "stash",
  ],
  shell: ["any"], // escape hatch — always requires extra confirmation
} as const;

export type CommandType = keyof typeof CATALOG;

// ---------------------------------------------------------------------------
// Zod schemas — Layer 2 defense against hallucinated output
// ---------------------------------------------------------------------------
export const StepSchema = z.object({
  id: z.number(),
  type: z.enum(["npm", "pnpm", "yarn", "bun", "git", "shell"]),
  command: z.string(),
  args: z.array(z.string()).default([]),
  description: z.string(),
  cwd: z.string().optional(), // optional working directory override
});

export const PlanSchema = z.object({
  goal: z.string(),
  steps: z.array(StepSchema).min(1).max(10),
});

export type Step = z.infer<typeof StepSchema>;
export type Plan = z.infer<typeof PlanSchema>;

// ---------------------------------------------------------------------------
// Catalog validation — Layer 3: check command is in whitelist
// ---------------------------------------------------------------------------
export function validateStep(step: Step): { valid: boolean; reason?: string } {
  const allowed = CATALOG[step.type];

  // shell type is always allowed but flagged for extra confirmation
  if (step.type === "shell") {
    return { valid: true };
  }

  if (!allowed.includes(step.command as never)) {
    return {
      valid: false,
      reason: `"${step.command}" is not an allowed command for type "${step.type}". Allowed: ${allowed.join(", ")}`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Build the catalog string injected into AI system prompt
// ---------------------------------------------------------------------------
export function buildCatalogPrompt(): string {
  const lines = Object.entries(CATALOG).map(([type, commands]) => {
    const list =
      commands[0] === "any"
        ? "any shell command (use sparingly)"
        : commands.join(", ");
    return `  - ${type}: [${list}]`;
  });

  return `Allowed command types and commands:\n${lines.join("\n")}`;
}
