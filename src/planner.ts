import {
  buildCatalogPrompt,
  createStepSchema,
  createPlanSchema,
  validateStep,
  buildCatalogMap,
  getAllTypeEnums,
  getCommandNames,
  type CatalogModule,
  type Plan,
  type Step,
} from "./catalogs/index.js";
import type { AIProvider, TokenUsage } from "./providers/types.js";
import { applyGuardrails } from "./guardrails.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// System prompt — constrains AI to only produce catalog-valid JSON
// ---------------------------------------------------------------------------
function buildSystemPrompt(
  cwd: string,
  forcedCatalogs?: string[],
  userPrompt?: string,
): string {
  return `You are a CLI task planner. Given a user's goal, generate a JSON execution plan.

${buildCatalogPrompt(cwd, forcedCatalogs, userPrompt)}

Rules:
- ONLY use command types and commands listed above
- Prefer pnpm over npm unless the user specifies otherwise
- Use "shell" type only when no other type fits
- Use "fs" type for filesystem operations (mkdir, rm, cp, mv, touch, cat, ls)
- Keep steps minimal — don't add unnecessary steps
- Each step must have a clear, short description
- NEVER generate a "cd" step — each step runs in a separate process so "cd" has no effect
- If subsequent steps need to run inside a cloned directory, set the "cwd" field instead
- For commands that take a message or value argument (like git commit -m), always keep the full message as a single array element, e.g. args: ["-m", "Update changes"] never args: ["-m", "Update", "changes"]

Respond ONLY with valid JSON matching this exact shape, no markdown, no explanation:
{
  "goal": "string describing the overall goal",
  "steps": [
    {
      "id": 1,
      "type": "git",
      "command": "commit",
      "args": ["-m", "Update changes"],
      "description": "Commit staged changes",
      "cwd": null
    },
    {
      "id": 2,
      "type": "pnpm",
      "command": "run",
      "args": ["dev", "--port", "3000"],
      "description": "Start dev server",
      "cwd": "my-repo"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Main planner function
// ---------------------------------------------------------------------------
export interface PlanResult {
  plan: Plan;
  usage: TokenUsage;
  warnings: string[];
}

const MAX_REPAIR_ATTEMPTS = 2;

interface StepFailure {
  stepId: number;
  reason: string;
}

function sumUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
  };
}

function normalizeStepCommand(
  step: Step,
  catalogMap: ReturnType<typeof buildCatalogMap>,
): Step {
  const raw = step.command.trim();
  if (!raw.includes(" ")) return step;

  const catalog = catalogMap.get(step.type);
  if (!catalog) return step;

  const commandNames = getCommandNames(catalog.commands);
  if (commandNames[0] === "any") return step;

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return step;

  const [topLevel, ...inlineArgs] = parts;
  if (!commandNames.includes(topLevel)) return step;

  const alreadyPrefixed = inlineArgs.every((token, i) => step.args[i] === token);
  const args = alreadyPrefixed ? step.args : [...inlineArgs, ...step.args];

  return {
    ...step,
    command: topLevel,
    args,
  };
}

function findCatalogFailure(
  plan: Plan,
  catalogMap: ReturnType<typeof buildCatalogMap>,
): { failure?: StepFailure; warnings: string[] } {
  const warnings: string[] = [];
  for (const step of plan.steps) {
    const check = validateStep(step, catalogMap);
    if (!check.valid) {
      return {
        failure: {
          stepId: step.id,
          reason: check.reason ?? "Unknown catalog validation error",
        },
        warnings,
      };
    }
    if (check.warnings) warnings.push(...check.warnings);
  }
  return { warnings };
}

function findGuardrailFailure(plan: Plan): { failure?: StepFailure; warnings: string[] } {
  const guardrailResult = applyGuardrails(plan.steps);
  if (guardrailResult.ok) return { warnings: guardrailResult.warnings };

  const firstError = guardrailResult.errors[0];
  const match = firstError.match(/^Step\s+(\d+):\s*(.+)$/i);
  if (!match) {
    return {
      failure: {
        stepId: plan.steps[0]?.id ?? 1,
        reason: firstError,
      },
      warnings: guardrailResult.warnings,
    };
  }

  return {
    failure: {
      stepId: Number(match[1]),
      reason: match[2],
    },
    warnings: guardrailResult.warnings,
  };
}

function buildRepairSystemPrompt(
  catalog: CatalogModule,
  cwd: string,
  userPrompt: string,
): string {
  return `You repair exactly one invalid CLI plan step.

${buildCatalogPrompt(cwd, [catalog.name], userPrompt)}

Rules:
- Return JSON only (no markdown).
- Keep id and type unchanged.
- command MUST be a valid top-level command for this type.
- Put subcommands and values in args[] as separate tokens.
- Do not include secrets/tokens/passwords/api keys in args.
- If required values are missing from user intent, keep placeholders short and explicit.

Output shape:
{
  "id": 1,
  "type": "catalog-type",
  "command": "command",
  "args": ["--flag", "value"],
  "description": "short action description",
  "cwd": null
}`;
}

async function repairStepWithAI(
  provider: AIProvider,
  input: {
    goal: string;
    userPrompt: string;
    failingStep: Step;
    failureReason: string;
    catalog: CatalogModule;
    cwd: string;
    debug: boolean;
  },
): Promise<{ step: Step; usage: TokenUsage }> {
  const systemPrompt = buildRepairSystemPrompt(
    input.catalog,
    input.cwd,
    input.userPrompt,
  );
  const repairPrompt = `Goal: ${input.goal}
User request: ${input.userPrompt}
Validation error: ${input.failureReason}

Invalid step JSON:
${JSON.stringify(input.failingStep, null, 2)}

Return only corrected step JSON.`;

  const response = await provider.generate(repairPrompt, systemPrompt);
  const cleaned = response.content.replace(/```json|```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Repair AI returned invalid JSON:\n${cleaned}`);
  }

  const RepairStepSchema = z.object({
    id: z.number(),
    type: z.string(),
    command: z.string(),
    args: z.array(z.string()).default([]),
    description: z.string(),
    cwd: z.string().nullable().optional(),
  });

  const result = RepairStepSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Repair step failed schema validation:\n${issues}`);
  }

  if (input.debug) {
    console.log("●  Repair response:");
    console.log(
      "│  " + JSON.stringify(result.data, null, 2).split("\n").join("\n│  "),
    );
    console.log("│");
  }

  const repairedStep: Step = {
    ...result.data,
    id: input.failingStep.id,
    type: input.failingStep.type,
  };

  return { step: repairedStep, usage: response.usage };
}

export async function generatePlan(
  userPrompt: string,
  provider: AIProvider,
  debug: boolean = false,
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
): Promise<PlanResult> {
  const systemPrompt = buildSystemPrompt(cwd, forcedCatalogs, userPrompt);

  if (debug) {
    console.log("┌");
    console.log("│");
    console.log("●  System prompt:");
    console.log(
      "│  " + systemPrompt.split("\n").slice(0, 8).join("\n│  ") + "...",
    );
    console.log("│");
  }

  const response = await provider.generate(userPrompt, systemPrompt);

  if (debug) {
    console.log("●  Raw AI response:");
    try {
      const parsed = JSON.parse(response.content);
      console.log(
        "│  " + JSON.stringify(parsed, null, 2).split("\n").join("\n│  "),
      );
    } catch {
      console.log("│  " + response.content);
    }
    console.log("│");
    console.log("◇  Plan ready");
    console.log("");
  }

  // Strip markdown fences if any provider wraps output
  const cleaned = response.content.replace(/```json|```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON:\n${cleaned}`);
  }

  // Layer 2: Zod shape validation (dynamic schema based on detected catalogs)
  const allTypes = getAllTypeEnums(cwd, forcedCatalogs, userPrompt);
  const StepSchema = createStepSchema(allTypes);
  const PlanSchema = createPlanSchema(StepSchema);

  const result = PlanSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Plan failed schema validation:\n${issues}`);
  }

  // Layer 3: Catalog whitelist + arg-level validation (+ targeted repair loop)
  const catalogMap = buildCatalogMap(cwd, forcedCatalogs, userPrompt);
  let normalizedPlan: Plan = {
    ...result.data,
    steps: result.data.steps.map((step) => normalizeStepCommand(step, catalogMap)),
  };
  let usage = response.usage;
  let allWarnings: string[] = [];

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    const catalogCheck = findCatalogFailure(normalizedPlan, catalogMap);
    if (catalogCheck.failure) {
      if (attempt === MAX_REPAIR_ATTEMPTS) {
        throw new Error(
          `Step ${catalogCheck.failure.stepId} failed catalog validation: ${catalogCheck.failure.reason}`,
        );
      }

      const failingStep = normalizedPlan.steps.find(
        (s) => s.id === catalogCheck.failure!.stepId,
      );
      if (!failingStep) {
        throw new Error(
          `Step ${catalogCheck.failure.stepId} failed catalog validation: ${catalogCheck.failure.reason}`,
        );
      }
      const catalog = catalogMap.get(failingStep.type);
      if (!catalog) {
        throw new Error(
          `Step ${catalogCheck.failure.stepId} failed catalog validation: Unknown type "${failingStep.type}"`,
        );
      }

      if (debug) {
        console.log(
          `●  Repairing step ${failingStep.id} (catalog): ${catalogCheck.failure.reason}`,
        );
        console.log("│");
      }

      const repaired = await repairStepWithAI(provider, {
        goal: normalizedPlan.goal,
        userPrompt,
        failingStep,
        failureReason: catalogCheck.failure.reason,
        catalog,
        cwd,
        debug,
      });
      usage = sumUsage(usage, repaired.usage);

      normalizedPlan = {
        ...normalizedPlan,
        steps: normalizedPlan.steps.map((s) =>
          s.id === failingStep.id
            ? normalizeStepCommand(repaired.step, catalogMap)
            : s,
        ),
      };
      continue;
    }

    const guardrailCheck = findGuardrailFailure(normalizedPlan);
    if (guardrailCheck.failure) {
      if (attempt === MAX_REPAIR_ATTEMPTS) {
        throw new Error(
          `Safety guardrail violations:\nStep ${guardrailCheck.failure.stepId}: ${guardrailCheck.failure.reason}`,
        );
      }

      const failingStep = normalizedPlan.steps.find(
        (s) => s.id === guardrailCheck.failure!.stepId,
      );
      if (!failingStep) {
        throw new Error(
          `Safety guardrail violations:\nStep ${guardrailCheck.failure.stepId}: ${guardrailCheck.failure.reason}`,
        );
      }
      const catalog = catalogMap.get(failingStep.type);
      if (!catalog) {
        throw new Error(
          `Safety guardrail violations:\nStep ${guardrailCheck.failure.stepId}: ${guardrailCheck.failure.reason}`,
        );
      }

      if (debug) {
        console.log(
          `●  Repairing step ${failingStep.id} (guardrail): ${guardrailCheck.failure.reason}`,
        );
        console.log("│");
      }

      const repaired = await repairStepWithAI(provider, {
        goal: normalizedPlan.goal,
        userPrompt,
        failingStep,
        failureReason: guardrailCheck.failure.reason,
        catalog,
        cwd,
        debug,
      });
      usage = sumUsage(usage, repaired.usage);

      normalizedPlan = {
        ...normalizedPlan,
        steps: normalizedPlan.steps.map((s) =>
          s.id === failingStep.id
            ? normalizeStepCommand(repaired.step, catalogMap)
            : s,
        ),
      };
      continue;
    }

    allWarnings = [...catalogCheck.warnings, ...guardrailCheck.warnings];
    break;
  }

  return {
    plan: normalizedPlan,
    usage,
    warnings: allWarnings,
  };
}
