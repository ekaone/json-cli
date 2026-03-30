import { buildCatalogPrompt, PlanSchema, validateStep } from "./catalog.js";
import type { AIProvider, TokenUsage } from "./providers/types.js";
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
export async function generatePlan(
  userPrompt: string,
  provider: AIProvider,
  debug: boolean = false,
): Promise<{ plan: Plan; usage: TokenUsage }> {
  const systemPrompt = buildSystemPrompt();

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

  return {
    plan: result.data,
    usage: response.usage,
  };
}
