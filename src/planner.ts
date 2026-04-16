import {
  buildCatalogPrompt,
  createStepSchema,
  createPlanSchema,
  validateStep,
  buildCatalogMap,
  getAllTypeEnums,
  getCommandNames,
  type Plan,
  type Step,
} from "./catalogs/index.js";
import type { AIProvider, TokenUsage } from "./providers/types.js";
import { applyGuardrails } from "./guardrails.js";

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

function normalizeStepCommand(step: Step, catalogMap: ReturnType<typeof buildCatalogMap>): Step {
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

  // Layer 3: Catalog whitelist + arg-level validation
  const catalogMap = buildCatalogMap(cwd, forcedCatalogs, userPrompt);
  const normalizedPlan: Plan = {
    ...result.data,
    steps: result.data.steps.map((step) => normalizeStepCommand(step, catalogMap)),
  };

  const allWarnings: string[] = [];
  for (const step of normalizedPlan.steps) {
    const check = validateStep(step, catalogMap);
    if (!check.valid) {
      throw new Error(
        `Step ${step.id} failed catalog validation: ${check.reason}`,
      );
    }
    if (check.warnings) {
      allWarnings.push(...check.warnings);
    }
  }

  // Layer 3.5: Generic safety guardrails
  const guardrailResult = applyGuardrails(normalizedPlan.steps);
  if (!guardrailResult.ok) {
    throw new Error(
      `Safety guardrail violations:\n${guardrailResult.errors.join("\n")}`,
    );
  }
  allWarnings.push(...guardrailResult.warnings);

  return {
    plan: normalizedPlan,
    usage: response.usage,
    warnings: allWarnings,
  };
}
