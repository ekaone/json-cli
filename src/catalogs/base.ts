import { z } from "zod";

// ---------------------------------------------------------------------------
// Command Definition (structured args schema)
// ---------------------------------------------------------------------------
export interface CommandArg {
  flag: string;
  required?: boolean;
  multiple?: boolean;
  valueHint?: string;
  conflictsWith?: string;
  forbidden?: boolean;
  secret?: boolean;
  default?: boolean | string;
}

export interface CommandDef {
  name: string;
  subcommands?: string[];
  args?: CommandArg[];
  forbiddenArgs?: string[];
  dangerous?: boolean;
  description?: string;
}

// ---------------------------------------------------------------------------
// Catalog Module Interface
// ---------------------------------------------------------------------------
export interface CatalogModule {
  name: string;
  commands: readonly string[] | readonly CommandDef[];
  detectors: readonly string[];
  typeEnum: readonly string[];
  triggers?: readonly string[];
  agentDoc?: string;
  buildPrompt(): string;
}

// ---------------------------------------------------------------------------
// Helpers for working with CommandDef[]
// ---------------------------------------------------------------------------
export function isCommandDefArray(
  commands: readonly string[] | readonly CommandDef[],
): commands is readonly CommandDef[] {
  return commands.length > 0 && typeof commands[0] !== "string";
}

export function getCommandNames(
  commands: readonly string[] | readonly CommandDef[],
): readonly string[] {
  if (!isCommandDefArray(commands)) return commands as readonly string[];
  return (commands as readonly CommandDef[]).map((c) => c.name);
}

export function findCommandDef(
  commands: readonly string[] | readonly CommandDef[],
  commandName: string,
): CommandDef | undefined {
  if (!isCommandDefArray(commands)) return undefined;
  return (commands as readonly CommandDef[]).find(
    (c) => c.name === commandName,
  );
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
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  warnings?: string[];
}

export function validateStep(
  step: Step,
  catalogMap: Map<string, CatalogModule>,
): ValidationResult {
  const catalog = catalogMap.get(step.type);

  if (!catalog) {
    return {
      valid: false,
      reason: `Unknown type "${step.type}"`,
    };
  }

  const commandNames = getCommandNames(catalog.commands);

  // "any" commands (shell catalog)
  if (commandNames[0] === "any") {
    return { valid: true };
  }

  // Command whitelist check
  if (!commandNames.includes(step.command)) {
    return {
      valid: false,
      reason: `"${step.command}" is not an allowed command for type "${step.type}". Allowed: ${commandNames.join(", ")}`,
    };
  }

  // Arg-level validation (only for CommandDef[] catalogs)
  const cmdDef = findCommandDef(catalog.commands, step.command);
  if (!cmdDef) return { valid: true };

  const warnings: string[] = [];

  // Check forbidden args
  const allForbidden = [
    ...(cmdDef.forbiddenArgs || []),
    ...(cmdDef.args || [])
      .filter((a) => a.forbidden || a.secret)
      .map((a) => a.flag),
  ];
  for (const arg of step.args) {
    for (const flag of allForbidden) {
      if (arg === flag || arg.startsWith(flag + "=")) {
        return {
          valid: false,
          reason: `Forbidden flag "${flag}" in step ${step.id} — secrets/auth should come from env vars or prior login`,
        };
      }
    }
  }

  // Check required args
  const requiredFlags = (cmdDef.args || [])
    .filter((a) => a.required)
    .map((a) => a.flag);
  for (const flag of requiredFlags) {
    const present = step.args.some(
      (a) => a === flag || a.startsWith(flag + "=") || a.startsWith(flag + " "),
    );
    if (!present) {
      return {
        valid: false,
        reason: `Missing required flag "${flag}" for "${cmdDef.name}" in step ${step.id}`,
      };
    }
  }

  // Check conflicts
  const conflictPairs = (cmdDef.args || []).filter((a) => a.conflictsWith);
  for (const arg of conflictPairs) {
    const hasThis = step.args.some(
      (a) => a === arg.flag || a.startsWith(arg.flag + "="),
    );
    const hasThat = step.args.some(
      (a) => a === arg.conflictsWith || a.startsWith(arg.conflictsWith + "="),
    );
    if (hasThis && hasThat) {
      return {
        valid: false,
        reason: `Conflicting flags "${arg.flag}" and "${arg.conflictsWith}" in step ${step.id}`,
      };
    }
  }

  // Dangerous action warning
  if (cmdDef.dangerous) {
    warnings.push(
      `Step ${step.id} is a potentially dangerous action ("${cmdDef.name}")`,
    );
  }

  return warnings.length > 0 ? { valid: true, warnings } : { valid: true };
}
