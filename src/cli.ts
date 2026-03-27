import * as p from "@clack/prompts";
import { resolveProvider, type ProviderName } from "./providers/index.js";
import { generatePlan } from "./planner.js";
import { runPlan } from "./runner.js";
import type { Step } from "./catalog.js";

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------
function showHelp(): void {
  p.intro("json-cli — AI-powered CLI task runner");
  p.log.message(`Usage\n  json-cli "<your goal>" [options]\n`);
  p.log.message(
    `Options
  --provider <name>   AI provider: claude | openai | ollama  (default: claude)
  --yes               Skip confirmation prompt
  --dry-run           Show plan without executing
  --help              Show this help message`,
  );
  p.log.message(
    `Examples
  json-cli "please run tests"
  json-cli "run tests and build"
  json-cli "run tests and build" --yes
  json-cli "git add, commit with message 'fix: bug', push"
  json-cli "clone https://github.com/user/repo, install deps, run dev"
  json-cli "run tests and publish" --provider openai
  json-cli "run tests" --dry-run`,
  );
  p.outro("Docs: https://github.com/ekaone/json-cli");
}

// ---------------------------------------------------------------------------
// Parse CLI args
// e.g. json-cli "run tests" --provider claude --yes --dry-run
// ---------------------------------------------------------------------------
function parseArgs(): {
  prompt: string;
  provider: ProviderName;
  yes: boolean;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);

  // show help if no args or --help flag
  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  const providerFlag = args.indexOf("--provider");
  const provider: ProviderName =
    providerFlag !== -1 ? (args[providerFlag + 1] as ProviderName) : "claude";

  const yes = args.includes("--yes");
  const dryRun = args.includes("--dry-run");

  const prompt = args
    .filter(
      (a, i) =>
        !a.startsWith("--") && (providerFlag === -1 || i !== providerFlag + 1),
    )
    .join(" ");

  if (!prompt) {
    showHelp();
    process.exit(0);
  }

  return { prompt, provider, yes, dryRun };
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
  const { prompt, provider: providerName, yes, dryRun } = parseArgs();

  p.intro(
    `json-cli — powered by ${providerName}${dryRun ? "  (dry run)" : ""}`,
  );

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

  // Step 4: Dry run — show plan and exit
  if (dryRun) {
    p.outro("Dry run complete — no commands were executed.");
    setTimeout(() => process.exit(0), 50);
  }

  // Step 5: Confirm — skip if --yes
  if (!yes) {
    const confirmed = await p.confirm({ message: "Proceed?" });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Aborted.");
      setTimeout(() => process.exit(0), 50);
    }
  } else {
    p.log.info("Skipping confirmation (--yes)");
  }

  // Step 6: Execute
  console.log("");
  const result = await runPlan(plan, (step, i, total) => {
    p.log.step(`Step ${i + 1}/${total}: ${formatStep(step)}`);
  });

  // Step 7: Result
  if (result.success) {
    p.outro("✅ All steps completed successfully.");
  } else {
    p.log.error(
      `❌ Failed at step ${result.failedStep?.id}: ${result.failedStep?.description}\n${result.error ?? ""}`,
    );
    setTimeout(() => process.exit(1), 50);
  }
}

main();
