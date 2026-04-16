import * as p from "@clack/prompts";
import { createRequire } from "module";
import { resolveProvider, type ProviderName } from "./providers/index.js";
import { generatePlan } from "./planner.js";
import { runPlan } from "./runner.js";
import { calculateCost, formatCost } from "./providers/pricing.js";
import { saveResume, loadResume, clearResume, hasResume } from "./resume.js";
import {
  appendHistory,
  getRecentHistory,
  clearHistory,
  hasHistory,
} from "./history.js";
import type { Step } from "./catalogs/index.js";

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------
function showHelp(): void {
  p.intro("json-cli — AI-powered CLI task runner");
  p.log.message(`Usage\n  json-cli "<your goal>" [options]\n`);
  p.log.message(`Alias\n  jc "<your goal>" [options]\n`);
  p.log.message(
    `Options
  --provider <name>   AI provider: claude | openai | ollama  (default: claude)
  --catalogs <list>   Force specific catalogs: package,git,docker,fs,shell,vercel,resend (comma-separated, optional)
  --yes               Skip confirmation prompt
  --dry-run           Show plan without executing
  --debug             Show system prompt and raw AI response
  --resume            Resume from last failed step
  --history           Browse and re-run past commands
  --history --clear   Clear command history
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
  json-cli "run tests" --debug --dry-run
  json-cli "deploy to prod" --catalogs docker
  json-cli "send welcome email" --catalogs resend
  json-cli "list files in E:" --catalogs fs
  json-cli --resume
  json-cli --history`,
  );
  p.outro("Docs: https://github.com/ekaone/json-cli");
}

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
function parseArgs(): {
  prompt: string;
  provider: ProviderName;
  catalogs: string[] | undefined;
  yes: boolean;
  dryRun: boolean;
  debug: boolean;
  resume: boolean;
  history: boolean;
  historyClear: boolean;
} {
  const args = process.argv.slice(2);
  const require = createRequire(import.meta.url);
  const { version, name } = require("../package.json");

  // version
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`${name}@${version}`);
    process.exit(0);
  }

  // help
  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  const providerFlag = args.indexOf("--provider");
  const provider: ProviderName =
    providerFlag !== -1 ? (args[providerFlag + 1] as ProviderName) : "claude";

  const catalogsFlag = args.indexOf("--catalogs");
  const catalogs: string[] | undefined =
    catalogsFlag !== -1
      ? args[catalogsFlag + 1]?.split(",").map((s) => s.trim())
      : undefined;

  const yes = args.includes("--yes");
  const dryRun = args.includes("--dry-run");
  const debug = args.includes("--debug");
  const resume = args.includes("--resume");
  const history = args.includes("--history");
  const historyClear = history && args.includes("--clear");

  const prompt = args
    .filter(
      (a, i) =>
        !a.startsWith("--") &&
        !a.startsWith("-v") &&
        (providerFlag === -1 || i !== providerFlag + 1) &&
        (catalogsFlag === -1 || i !== catalogsFlag + 1),
    )
    .join(" ");

  // resume and history don't need a prompt
  if (!prompt && !resume && !history) {
    showHelp();
    process.exit(0);
  }

  return {
    prompt,
    provider,
    catalogs,
    yes,
    dryRun,
    debug,
    resume,
    history,
    historyClear,
  };
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
// Format usage string
// ---------------------------------------------------------------------------
function formatUsage(
  input: number,
  output: number,
  provider: ProviderName,
): string {
  if (input === 0 && output === 0) return "";
  const cost = calculateCost(provider, input, output);
  const costStr = formatCost(cost);
  return `  |  tokens: ${input} in / ${output} out${costStr ? `  |  ${costStr}` : ""}`;
}

// ---------------------------------------------------------------------------
// Handle --history
// ---------------------------------------------------------------------------
async function handleHistory(): Promise<string | null> {
  p.intro("json-cli — history");

  if (!hasHistory()) {
    p.log.warn("No history found.");
    await new Promise((r) => setTimeout(r, 100));
    process.exit(0);
  }

  const entries = getRecentHistory();
  const options = entries.map((e) => ({
    value: e.prompt,
    label: `${e.prompt.slice(0, 60)}${e.prompt.length > 60 ? "..." : ""}`,
    hint: `${e.steps} steps · ${e.provider} · ${new Date(e.timestamp).toLocaleString()}`,
  }));

  options.unshift({
    value: "__exit__",
    label: "Exit",
    hint: "Close without running",
  });

  options.push({
    value: "__clear__",
    label: "Clear history",
    hint: "Remove all entries",
  });

  const selected = await p.select({
    message: "Pick a command to re-run:",
    options,
  });

  if (selected === "__exit__") {
    p.cancel("Cancelled.");
    await new Promise((r) => setTimeout(r, 100));
    process.exit(0);
  }

  if (p.isCancel(selected)) {
    p.cancel("Cancelled.");
    await new Promise((r) => setTimeout(r, 100));
    process.exit(0);
  }

  if (selected === "__clear__") {
    clearHistory();
    p.outro("History cleared.");
    await new Promise((r) => setTimeout(r, 100));
    process.exit(0);
  }

  return selected as string;
}

// ---------------------------------------------------------------------------
// Handle --resume
// ---------------------------------------------------------------------------
async function handleResume(): Promise<{
  prompt: string;
  provider: ProviderName;
  startFrom: number;
} | null> {
  if (!hasResume()) {
    p.log.warn("No resume state found — nothing to resume.");
    await new Promise((r) => setTimeout(r, 100));
    process.exit(0);
  }

  const data = loadResume()!;
  const resumeFrom = data.failedAt;

  p.intro(`json-cli — resuming from step ${resumeFrom + 1}`);
  p.log.info(`Original goal: ${data.plan.goal}`);
  p.log.message(`Skipping steps 1-${resumeFrom}, resuming from:`);

  data.plan.steps.slice(resumeFrom).forEach((step, i) => {
    p.log.message(`  ${resumeFrom + i + 1}. ${formatStep(step)}`);
  });

  return {
    prompt: data.prompt,
    provider: data.provider,
    startFrom: resumeFrom,
  };
}

// ---------------------------------------------------------------------------
// Execute plan
// ---------------------------------------------------------------------------
async function executePlan(
  planResult: Awaited<ReturnType<typeof generatePlan>>,
  providerName: ProviderName,
  prompt: string,
  yes: boolean,
  startFrom = 0,
): Promise<void> {
  // Confirm
  if (!yes) {
    const confirmed = await p.confirm({
      message: startFrom > 0 ? "Resume execution?" : "Proceed?",
    });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Aborted.");
      await new Promise((r) => setTimeout(r, 100));
      process.exit(0);
    }
  } else {
    p.log.info("Skipping confirmation (--yes)");
  }

  // Execute
  console.log("");
  const result = await runPlan(
    planResult.plan,
    (step, i, total) => {
      p.log.step(`Step ${i + 1}/${total}: ${formatStep(step)}`);
    },
    startFrom,
  );

  const usageStr = formatUsage(
    planResult.usage.input,
    planResult.usage.output,
    providerName,
  );

  if (result.success) {
    // clear resume on success
    clearResume();

    // append to history
    appendHistory({
      prompt,
      provider: providerName,
      steps: planResult.plan.steps.length,
      success: true,
      timestamp: new Date().toISOString(),
    });

    p.outro(`✅ All steps completed successfully.${usageStr}`);
  } else {
    // save resume state on failure
    saveResume({
      plan: planResult.plan,
      failedAt: result.failedIndex ?? 0,
      provider: providerName,
      prompt,
      timestamp: new Date().toISOString(),
    });

    p.log.error(
      `❌ Failed at step ${result.failedStep?.id}: ${result.failedStep?.description}\n${result.error ?? ""}`,
    );
    p.log.warn('Run "json-cli --resume" to continue from this step.');
    await new Promise((r) => setTimeout(r, 100));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const {
    prompt,
    provider: providerName,
    catalogs,
    yes,
    dryRun,
    debug,
    resume,
    history,
    historyClear,
  } = parseArgs();

  // ---------------------------------------------------------------------------
  // Handle --history --clear
  // ---------------------------------------------------------------------------
  if (historyClear) {
    clearHistory();
    p.outro("History cleared.");
    await new Promise((r) => setTimeout(r, 100));
    process.exit(0);
  }

  // ---------------------------------------------------------------------------
  // Handle --history
  // ---------------------------------------------------------------------------
  if (history) {
    const selected = await handleHistory();
    if (!selected) process.exit(0);

    // re-run selected prompt
    p.intro(`json-cli — powered by ${providerName}`);
    const spinner = p.spinner();
    spinner.start("Thinking...");
    const provider = resolveProvider(providerName);
    const planResult = await generatePlan(
      selected,
      provider,
      false,
      process.cwd(),
      catalogs,
    );
    spinner.stop("Plan ready");

    p.log.info(`Goal: ${planResult.plan.goal}\n`);
    planResult.plan.steps.forEach((step, i) => {
      p.log.message(`  ${i + 1}. ${formatStep(step)}`);
    });

    if (planResult.warnings.length > 0) {
      planResult.warnings.forEach((w) => p.log.warn(w));
    }

    await executePlan(planResult, providerName, selected, yes);
    return;
  }

  // ---------------------------------------------------------------------------
  // Handle --resume
  // ---------------------------------------------------------------------------
  if (resume) {
    const resumeState = await handleResume();
    if (!resumeState) process.exit(0);

    const data = loadResume()!;
    const planResult = {
      plan: data.plan,
      usage: { input: 0, output: 0 },
      warnings: [],
    };

    await executePlan(
      planResult,
      resumeState.provider,
      resumeState.prompt,
      yes,
      resumeState.startFrom,
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Normal flow
  // ---------------------------------------------------------------------------
  p.intro(
    `json-cli — powered by ${providerName}${dryRun ? "  (dry run)" : ""}${debug ? "  (debug)" : ""}`,
  );

  // Step 1: Generate plan
  const spinner = p.spinner();
  spinner.start("Thinking...");

  let planResult;
  try {
    const provider = resolveProvider(providerName);
    planResult = await generatePlan(
      prompt,
      provider,
      debug,
      process.cwd(),
      catalogs,
    );
    spinner.stop(debug ? undefined : "Plan ready");
  } catch (err) {
    spinner.stop("Failed to generate plan");
    p.log.error(err instanceof Error ? err.message : String(err));
    await new Promise((r) => setTimeout(r, 100));
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

  // Step 3.5: Display validation/guardrail warnings
  if (planResult.warnings.length > 0) {
    planResult.warnings.forEach((w) => p.log.warn(w));
  }

  // Step 4: Dry run — show plan and exit
  if (dryRun) {
    const usageStr = formatUsage(
      planResult.usage.input,
      planResult.usage.output,
      providerName,
    );
    p.outro(`Dry run complete — no commands were executed.${usageStr}`);
    await new Promise((r) => setTimeout(r, 100));
    process.exit(0);
  }

  // Step 5 - 7: Confirm + Execute
  await executePlan(planResult, providerName, prompt, yes);
}

main();
