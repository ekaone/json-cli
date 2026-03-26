import { buildCatalogPrompt, PlanSchema, validateStep } from "./catalog.js";
import type { AIProvider } from "./providers/types.js";
import type { Plan } from "./catalog.js";

// ---------------------------------------------------------------------------
// System prompt — constrains AI to only produce catalog-valid JSON
// ---------------------------------------------------------------------------
function buildSystemPrompt(): string {
  return `You are a CLI task planner. Given a user's goal, generate a JSON execution plan.

${buildCatalogPrompt()}

Rules:
- ONLY use command types and commands listed above
- Prefer pnpm over npm unless the user specifies otherwise
- Use "shell" type only when no other type fits
- Keep steps minimal — don't add unnecessary steps
- Each step must have a clear, short description
- NEVER generate a "cd" step — each step runs in a separate process so "cd" has no effect
- If subsequent steps need to run inside a cloned directory, set the "cwd" field instead

Respond ONLY with valid JSON matching this exact shape, no markdown, no explanation:
{
  "goal": "string describing the overall goal",
  "steps": [
    {
      "id": 1,
      "type": "pnpm",
      "command": "run",
      "args": ["dev"],
      "description": "Start dev server"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Main planner function
// ---------------------------------------------------------------------------
export async function generatePlan(
  userPrompt: string,
  provider: AIProvider,
): Promise<Plan> {
  const raw = await provider.generate(userPrompt, buildSystemPrompt());

  // Strip markdown fences if any provider wraps output
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON:\n${cleaned}`);
  }

  // Layer 2: Zod shape validation
  const result = PlanSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Plan failed schema validation:\n${issues}`);
  }

  // Layer 3: Catalog whitelist validation
  for (const step of result.data.steps) {
    const check = validateStep(step);
    if (!check.valid) {
      throw new Error(
        `Step ${step.id} failed catalog validation: ${check.reason}`,
      );
    }
  }

  return result.data;
}
