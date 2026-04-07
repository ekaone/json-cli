import { execa } from "execa";
import type { Plan, Step } from "./catalogs/index.js";

// ---------------------------------------------------------------------------
// Build the actual shell command from a Step
// ---------------------------------------------------------------------------
function resolveCommand(step: Step): { bin: string; args: string[] } {
  switch (step.type) {
    case "shell":
      return { bin: step.command, args: step.args };
    case "fs":
      // Filesystem commands need special handling
      return { bin: step.command, args: step.args };
    case "docker":
      return { bin: "docker", args: [step.command, ...step.args] };
    default:
      // npm, pnpm, yarn, bun, git
      return { bin: step.type, args: [step.command, ...step.args] };
  }
}

// ---------------------------------------------------------------------------
// Run a single step, streaming stdout/stderr live
// ---------------------------------------------------------------------------
export async function runStep(
  step: Step,
): Promise<{ success: boolean; error?: string }> {
  const { bin, args } = resolveCommand(step);

  try {
    await execa(bin, args, {
      cwd: step.cwd ?? process.cwd(),
      stdout: "inherit",
      stderr: "inherit",
    });
    return { success: true };
  } catch (err: any) {
    const parts = [
      `Command: ${bin} ${args.join(" ")}`,
      err?.exitCode ? `Exit code: ${err.exitCode}` : null,
      err?.stderr ? `Reason: ${err.stderr.trim()}` : null,
      !err?.stderr ? (err?.message ?? String(err)) : null,
    ]
      .filter(Boolean)
      .join("\n   ");

    return { success: false, error: parts };
  }
}

// ---------------------------------------------------------------------------
// Run the full plan, stopping on first failure
// startFrom: step index (0-based) to resume from — skips earlier steps
// ---------------------------------------------------------------------------
export async function runPlan(
  plan: Plan,
  onStep: (step: Step, index: number, total: number) => void,
  startFrom = 0, // ← new param for resume
): Promise<{
  success: boolean;
  failedStep?: Step;
  failedIndex?: number;
  error?: string;
}> {
  const total = plan.steps.length;

  for (let i = startFrom; i < total; i++) {
    const step = plan.steps[i];
    onStep(step, i, total);

    const result = await runStep(step);

    if (!result.success) {
      return {
        success: false,
        failedStep: step,
        failedIndex: i,
        error: result.error,
      };
    }
  }

  return { success: true };
}
