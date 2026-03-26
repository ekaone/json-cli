import * as p from "@clack/prompts";
import { resolveProvider, type ProviderName } from "./providers/index.js";
import { generatePlan } from "./planner.js";
import { runPlan } from "./runner.js";
import type { Step } from "./catalog.js";

// ---------------------------------------------------------------------------
// Parse CLI args
// e.g. json-cli "run tests" --provider claude
// ---------------------------------------------------------------------------
function parseArgs(): { prompt: string; provider: ProviderName } {
  const args = process.argv.slice(2);
  const providerFlag = args.indexOf("--provider");
  const provider: ProviderName =
    providerFlag !== -1 ? (args[providerFlag + 1] as ProviderName) : "claude";

  const prompt = args
    .filter(
      (a, i) =>
        !a.startsWith("--") && (providerFlag === -1 || i !== providerFlag + 1),
    )
    .join(" ");

  if (!prompt) {
    console.error(
      'Usage: json-cli "<your goal>" [--provider claude|openai|ollama]',
    );
    process.exit(1);
  }

  return { prompt, provider };
}

// ---------------------------------------------------------------------------
// Format a step for display
// ---------------------------------------------------------------------------
function formatStep(step: Step): string {
  const cmd =
    step.type === "shell"
      ? `${step.command} ${step.args.join(" ")}`
      : `${step.type} ${step.command} ${step.args.join(" ")}`.trim();
  return `${cmd.padEnd(35)} → ${step.description}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { prompt, provider: providerName } = parseArgs();

  p.intro(`json-cli — powered by ${providerName}`);

  // Step 1: Generate plan
  const spinner = p.spinner();
  spinner.start("Thinking...");

  let plan;
  try {
    const provider = resolveProvider(providerName);
    plan = await generatePlan(prompt, provider);
    spinner.stop("Plan ready");
  } catch (err) {
    spinner.stop("Failed to generate plan");
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 2: Show plan
  p.log.info(`Goal: ${plan.goal}\n`);
  plan.steps.forEach((step, i) => {
    const isShell = step.type === "shell";
    p.log.message(
      `  ${i + 1}. ${formatStep(step)}${isShell ? "  ⚠ shell" : ""}`,
    );
  });

  // Step 3: Extra warning if any shell steps
  const hasShell = plan.steps.some((s) => s.type === "shell");
  if (hasShell) {
    p.log.warn(
      "Plan contains shell commands — review carefully before proceeding.",
    );
  }

  // Step 4: Confirm
  const confirmed = await p.confirm({ message: "Proceed?" });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Aborted.");
    process.exit(0);
  }

  // Step 5: Execute
  console.log("");
  const result = await runPlan(plan, (step, i, total) => {
    p.log.step(`Step ${i + 1}/${total}: ${formatStep(step)}`);
  });

  // Step 6: Result
  if (result.success) {
    p.outro("✅ All steps completed successfully.");
  } else {
    p.log.error(
      `❌ Failed at step ${result.failedStep?.id}: ${result.failedStep?.description}\n${result.error ?? ""}`,
    );
    process.exit(1);
  }
}

main();
