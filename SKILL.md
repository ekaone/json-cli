---
name: json-cli
description: AI-powered CLI task runner that translates plain English into validated JSON command plans and executes them step by step
version: 0.2.3
author: Eka Prasetia
license: MIT
repository: https://github.com/ekaone/json-cli
npm: "@ekaone/json-cli"
---

# json-cli — AI-Powered CLI Task Runner

## Overview

`json-cli` (alias `jc`) is an AI-powered CLI tool that takes plain English input, generates a validated JSON command plan via an AI provider, and executes the plan step by step with confirmation prompts. It supports multi-intent chaining (e.g., "run tests and then build") and enforces safety through catalog whitelists and Zod schema validation.

## Architecture

```
User Prompt (plain English)
    │
    ▼
CLI (src/cli.ts)          ← arg parsing, orchestration, display
    │
    ▼
Planner (src/planner.ts)  ← builds system prompt, calls AI, validates response
    │
    ├─► AI Provider        ← claude.ts | openai.ts | ollama.ts
    │      (src/providers/)
    │
    ├─► Zod Validation     ← dynamic schema based on active catalogs
    │      (src/catalogs/base.ts)
    │
    └─► Catalog Check      ← whitelist prevents hallucinated commands
           (src/catalogs/index.ts)
    │
    ▼
Runner (src/runner.ts)    ← executes steps via execa, streams output live
    │
    ▼
Resume / History          ← persistence in ~/.json-cli/
```

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | Main CLI entry point — arg parsing, display formatting, orchestration |
| `src/planner.ts` | `generatePlan()` — builds system prompt, calls provider, validates response |
| `src/runner.ts` | `runPlan()` / `runStep()` — executes steps via `execa`, stops on first failure |
| `src/catalogs/index.ts` | Catalog auto-detection, prompt building, command map construction |
| `src/catalogs/base.ts` | `CatalogModule` interface, Zod schemas (`createStepSchema`, `createPlanSchema`), `validateStep()` |
| `src/providers/index.ts` | `resolveProvider()` — factory for provider instances |
| `src/providers/types.ts` | `AIProvider` and `TokenUsage` interfaces |
| `src/providers/claude.ts` | Claude provider (Anthropic SDK, model: `claude-sonnet-4-6`) |
| `src/providers/openai.ts` | OpenAI provider (OpenAI SDK, model: `gpt-4o`, JSON mode) |
| `src/providers/ollama.ts` | Ollama provider (local, REST API, default model: `llama3.2`) |
| `src/providers/pricing.ts` | Token cost calculation per provider |
| `src/resume.ts` | Save/load/clear resume state (`~/.json-cli/last-plan.json`) |
| `src/history.ts` | Append/browse/clear history (`~/.json-cli/history.json`, max 50 entries) |
| `src/index.ts` | Public API exports (`generatePlan`, `runPlan`, `Plan`, `Step`, `AIProvider`) |

## Catalogs (Command Whitelists)

Catalogs define allowed commands. Auto-detection is based on project files:

| Catalog | Auto-detected when | Type Enums | Commands |
|---------|-------------------|------------|----------|
| `package` | `package.json` exists | `pnpm`, `npm`, `yarn`, `bun` | install, run, build, test, publish, add, remove, etc. |
| `git` | `.git/` exists | `git` | init, add, commit, push, pull, clone, status, log, etc. |
| `docker` | `Dockerfile` or `docker-compose.yml` exists | `docker` | build, run, compose, push, pull, exec, logs, etc. |
| `fs` | Always included | `fs` | mkdir, rm, cp, mv, touch, cat, ls, dir |
| `shell` | Always included | `shell` | any (escape hatch, requires extra confirmation) |

Override with `--catalogs <list>` (comma-separated).

## Validation Layers

1. **JSON parse** — raw AI response must be valid JSON
2. **Zod schema** — dynamic schema based on active catalogs validates shape, type enum, and constraints (1–10 steps)
3. **Catalog whitelist** — each step's `type` + `command` must be in the active catalog's command map

## CLI Options

| Flag | Description |
|------|-------------|
| `--provider <name>` | AI provider: `claude` (default) \| `openai` \| `ollama` |
| `--catalogs <list>` | Force specific catalogs (comma-separated) |
| `--yes` | Skip confirmation prompt |
| `--dry-run` | Show plan without executing |
| `--debug` | Show system prompt and raw AI response |
| `--resume` | Resume from last failed step |
| `--history` | Browse and re-run past commands |
| `--history --clear` | Clear command history |
| `--help` | Show help message |
| `--version`, `-v` | Show version |

## Environment Variables

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | OpenAI |
| *(none)* | Ollama (local, no key needed) |

## Data Flow

1. **Parse args** → `parseArgs()` in `cli.ts`
2. **Build system prompt** → `buildSystemPrompt()` in `planner.ts` assembles catalog info + rules
3. **Call AI** → `provider.generate(userPrompt, systemPrompt)` returns raw JSON + token usage
4. **Validate** → JSON parse → Zod schema → catalog whitelist (3 layers)
5. **Display plan** → formatted step list with goal, confirmation prompt
6. **Execute** → `runPlan()` runs steps sequentially via `execa`, streams output live
7. **Persist** → on failure: save resume state; on success: append to history

## Debug Mode (`--debug`)

When `--debug` is passed:
- Prints the system prompt (first 8 lines) before calling the AI provider
- Prints the raw AI response (pretty-printed JSON) before Zod validation
- Useful for diagnosing schema failures or AI hallucinations

## Step Schema

```typescript
{
  id: number;           // step number (1-based)
  type: string;         // catalog type enum (pnpm, npm, git, docker, fs, shell)
  command: string;      // specific command within the type
  args: string[];       // arguments and flags
  description: string;  // human-readable description
  cwd?: string | null;  // working directory override (for cloned repos)
}
```

## Plan Schema

```typescript
{
  goal: string;    // overall goal description
  steps: Step[];   // 1–10 steps
}
```

## Development

```bash
pnpm install                    # install dependencies
pnpm dev "please run tests"     # run CLI in dev mode (tsx)
pnpm test                       # run tests (vitest)
pnpm typecheck                  # TypeScript type checking
pnpm build                      # typecheck + test + clean + tsup
```

## Build

Uses `tsup` for bundling. Outputs:
- `dist/index.js` (ESM)
- `dist/index.cjs` (CJS)
- `dist/index.d.ts` (types)
- `dist/cli.cjs` (CLI binary entry)

## Testing

- Framework: Vitest
- Test file: `tests/planner.test.ts`
- Run: `pnpm test` or `pnpm test:watch`

## Public API

The package exports programmatic access via `src/index.ts`:

```typescript
import { generatePlan, runPlan } from "@ekaone/json-cli";
import type { Plan, Step, AIProvider } from "@ekaone/json-cli";
```

## Persistence

All state is stored in `~/.json-cli/`:
- `last-plan.json` — resume state (saved on failure, cleared on success)
- `history.json` — command history (max 50 entries)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Claude API client |
| `openai` | OpenAI API client |
| `zod` | Runtime schema validation |
| `execa` | Shell command execution with streaming |
| `@clack/prompts` | Interactive CLI prompts (select, confirm, spinner) |
