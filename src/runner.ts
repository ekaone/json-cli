import { execa } from "execa";
import type { Plan, Step } from "./catalog.js";

// ---------------------------------------------------------------------------
// Build the actual shell command from a Step
// ---------------------------------------------------------------------------
function resolveCommand(step: Step): { bin: string; args: string[] } {
  if (step.type === "shell") {
    // shell: command is the binary, args are the args
    return { bin: step.command, args: step.args };
  }

  // For npm/pnpm/yarn/bun/git: binary is the type, command + args follow
  return { bin: step.type, args: [step.command, ...step.args] };
}

// ---------------------------------------------------------------------------
// Run a single step, streaming stdout/stderr live
// ---------------------------------------------------------------------------
export async function runStep(step: Step): Promise<{ success: boolean; error?: string }> {
  const { bin, args } = resolveCommand(step);

  try {
    await execa(bin, args, {
      cwd:    step.cwd ?? process.cwd(),
      stdout: "inherit", // stream directly to terminal
      stderr: "inherit",
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Run the full plan, stopping on first failure
// ---------------------------------------------------------------------------
export async function runPlan(
  plan: Plan,
  onStep: (step: Step, index: number, total: number) => void
): Promise<{ success: boolean; failedStep?: Step; error?: string }> {
  const total = plan.steps.length;

  for (let i = 0; i < total; i++) {
    const step = plan.steps[i];
    onStep(step, i, total);

    const result = await runStep(step);

    if (!result.success) {
      return { success: false, failedStep: step, error: result.error };
    }
  }

  return { success: true };
}
