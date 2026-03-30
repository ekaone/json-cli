import * as p from "@clack/prompts";
import { createRequire } from "module";
import { resolveProvider, type ProviderName } from "./providers/index.js";
import { generatePlan } from "./planner.js";
import { runPlan } from "./runner.js";
import { calculateCost, formatCost } from "./providers/pricing.js";
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
  --debug             Show system prompt and raw AI response
  --help              Show this help message
  --version, -v       Show version`,
  );
  p.log.message(
    `Examples
  json-cli "please run tests"
  json-cli "run tests and build"
  json-cli "run tests and build" --yes
  json-cli "git add, commit with message 'fix: bug', push"
  json-cli "clone https://github.com/user/repo, install deps, run dev"
  json-cli "run tests and publish" --provider openai
  json-cli "run tests" --dry-run
  json-cli "run tests" --debug
  json-cli "run tests" --debug --dry-run`,
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
  debug: boolean;
} {
  const args = process.argv.slice(2);
  const require = createRequire(import.meta.url);
  const { version, name } = require("../package.json");

  // show version
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`${name}@${version}`);
    process.exit(0);
  }

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
  const debug = args.includes("--debug");

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

  return { prompt, provider, yes, dryRun, debug };
}

// ---------------------------------------------------------------------------
// Format a step for display
// ---------------------------------------------------------------------------
function formatStep(step: Step): string {
  const formatArg = (arg: string) => (arg.includes(" ") ? `"${arg}"` : arg);
  const cmd =
    step.type === "shell"
      ? `${step.command} ${step.args.map(formatArg).join(" ")}`
      : `${step.type} ${step.command} ${step.args.map(formatArg).join(" ")}`.trim();
  return `${cmd.padEnd(35)} → ${step.description}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { prompt, provider: providerName, yes, dryRun, debug } = parseArgs();

  p.intro(
    `json-cli — powered by ${providerName}${dryRun ? "  (dry run)" : ""}${debug ? "  (debug)" : ""}`,
  );

  // Step 1: Generate plan
  const spinner = p.spinner();
  spinner.start("Thinking...");

  let planResult;
  try {
    const provider = resolveProvider(providerName);
    planResult = await generatePlan(prompt, provider, debug);
    spinner.stop(debug ? "" : "Plan ready");
  } catch (err) {
    spinner.stop("Failed to generate plan");
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 2: Show plan
  p.log.info(`Goal: ${planResult.plan.goal}\n`);
  planResult.plan.steps.forEach((step, i) => {
    const isShell = step.type === "shell";
    p.log.message(
      `  ${i + 1}. ${formatStep(step)}${isShell ? "  ⚠ shell" : ""}`,
    );
  });

  // Step 3: Extra warning if any shell steps
  const hasShell = planResult.plan.steps.some((s) => s.type === "shell");
  if (hasShell) {
    p.log.warn(
      "Plan contains shell commands — review carefully before proceeding.",
    );
  }

  // Step 4: Dry run — show plan and exit
  if (dryRun) {
    const { input, output } = planResult.usage;
    const cost = calculateCost(providerName, input, output);
    const costStr = formatCost(cost);
    const usageStr =
      input > 0 || output > 0
        ? `  |  tokens: ${input} in / ${output} out${costStr ? `  |  ${costStr}` : ""}`
        : "";

    p.outro(`Dry run complete — no commands were executed.${usageStr}`);
    await new Promise((r) => setTimeout(r, 100));
    process.exit(0);
  }

  // Step 5: Confirm — skip if --yes
  if (!yes) {
    const confirmed = await p.confirm({ message: "Proceed?" });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Aborted.");
      await new Promise((r) => setTimeout(r, 100));
      process.exit(0);
    }
  } else {
    p.log.info("Skipping confirmation (--yes)");
  }

  // Step 6: Execute
  console.log("");
  const result = await runPlan(planResult.plan, (step, i, total) => {
    p.log.step(`Step ${i + 1}/${total}: ${formatStep(step)}`);
  });

  // Step 7: Result
  if (result.success) {
    const { input, output } = planResult.usage;
    const cost = calculateCost(providerName, input, output);
    const costStr = formatCost(cost);
    const usageStr =
      input > 0 || output > 0
        ? `  |  tokens: ${input} in / ${output} out${costStr ? `  |  ${costStr}` : ""}`
        : "";

    p.outro(`✅ All steps completed successfully.${usageStr}`);
  } else {
    p.log.error(
      `❌ Failed at step ${result.failedStep?.id}: ${result.failedStep?.description}\n${result.error ?? ""}`,
    );
    await new Promise((r) => setTimeout(r, 100));
    process.exit(1);
  }
}

main();
