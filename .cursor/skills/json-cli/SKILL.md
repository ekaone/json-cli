---
name: json-cli (project skill)
description: Work effectively in @ekaone/json-cli — an AI-powered CLI that turns natural language into validated JSON command plans and executes them safely.
version: 1.0.0
---

## What this skill is for

Use this skill when you need to modify, extend, test, or release this repository (`@ekaone/json-cli`). It encodes the project’s architecture, safety model, and the expected dev workflow so changes stay consistent.

## Quick project map (src/)

- **Entrypoints**
  - `src/cli.ts`: CLI UX, arg parsing, plan display, confirmation, `--dry-run`, `--debug`, `--resume`, `--history`.
  - `src/index.ts`: public SDK exports (`generatePlan`, `runPlan`, and types).
- **Core pipeline**
  - `src/planner.ts`: builds the system prompt from active catalogs, calls the provider, strips fences, JSON-parses, validates via Zod + catalog whitelist.
  - `src/runner.ts`: resolves step → actual command, executes via `execa`, streams output, supports resume via `startFrom`.
- **Catalog safety layer**
  - `src/catalogs/index.ts`: auto-detect active catalogs and build prompt/command map.
  - `src/catalogs/base.ts`: `CatalogModule` contract, Zod schema builders, `validateStep`.
  - `src/catalogs/*/index.ts`: catalog implementations (`package`, `git`, `docker`, `fs`, `shell`).
- **Providers**
  - `src/providers/*.ts`: Claude / OpenAI / Ollama adapters implementing `AIProvider` (`src/providers/types.ts`).
  - `src/providers/pricing.ts`: token cost calculation + formatting.
- **Persistence**
  - `src/resume.ts`: `~/.json-cli/last-plan.json` (resume after failure).
  - `src/history.ts`: `~/.json-cli/history.json` (max 50 entries, browse recent).

## Golden rules (don’t break these)

- **Safety invariants**
  - The planner must keep **3 layers** intact: JSON parse → **Zod shape** (dynamic enum) → **catalog whitelist**.
  - Never weaken catalog validation to “make it work”. Add a command to the correct catalog instead.
  - The system prompt rule **“never generate a cd step”** is intentional. If steps need to run in a subfolder, use `step.cwd`.
- **Cross-platform**
  - `fs` steps use `ls/dir` mapping in `runner.ts`. If you add new `fs` commands, consider Windows vs POSIX behavior.
  - Keep Node compatibility at **>= 18**. This is enforced via `package.json` and `tsup` targets.
- **Build outputs**
  - Library build is ESM+CJS; CLI build is **CJS with shebang** (see `tsup.config.ts` note about Node 24 + Windows).
  - If you touch the CLI entry, ensure the CJS/shebang output still works.

## Standard development commands

- **Install**: `pnpm install`
- **Dev CLI**: `pnpm dev "run tests and build"`
- **Typecheck**: `pnpm typecheck`
- **Tests**: `pnpm test` (or `pnpm test:watch`)
- **Build**: `pnpm build` (runs typecheck + tests + clean + tsup)

## How to implement changes (playbooks)

### Add a new allowed command

1. Decide the correct catalog: `package`, `git`, `docker`, `fs`, or `shell`.
2. Update `src/catalogs/<catalog>/index.ts`:
   - Add the command to the catalog’s `commands` list (or keep `["any"]` only for `shell`).
   - Ensure the catalog’s `typeEnum` still represents the type(s) for that catalog (e.g. `pnpm|npm|yarn|bun`).
3. Ensure `buildPrompt()` reflects the new command so the AI can select it.
4. Add/adjust tests in `tests/planner.test.ts` (at minimum: one plan that uses the new command, one that should still reject hallucinations).

### Change the plan schema

- Update the dynamic schema in `src/catalogs/base.ts` and ensure:
  - defaults remain safe (e.g. `args` defaults to `[]`),
  - limits (1–10 steps) remain,
  - `type` remains a **dynamic enum** built from active catalogs.
- Then update:
  - planner prompt JSON shape in `src/planner.ts`,
  - formatting in `src/cli.ts` if a new field affects display,
  - execution logic in `src/runner.ts` if it affects runtime behavior.

### Add/modify a provider

- Keep provider implementations conforming to `AIProvider` (`src/providers/types.ts`).
- Ensure `resolveProvider()` supports it and CLI `--provider` help text is updated.
- Providers must return **only JSON** (or at least JSON-ish text that `planner.ts` can clean/parse).
- If the provider can return markdown fences, keep the fence-stripper behavior in `planner.ts` compatible.

### Modify execution behavior

- All execution goes through `runStep()` in `src/runner.ts`. Keep:
  - streaming output (`stdout: "inherit"`, `stderr: "inherit"`),
  - correct `cwd` resolution (`step.cwd ?? process.cwd()`),
  - command resolution rules (`shell` passes through, `docker` prefixes `docker`, `npm/pnpm/...` use `type` as binary).

### History/resume changes

- Preserve file locations under `~/.json-cli/`.
- Keep JSON formats stable or provide a backward-compatible migration (prefer additive fields).

## Testing expectations

- Add/adjust tests under `tests/` (Vitest). Minimum checks for planner changes:
  - valid plan parses,
  - markdown-fence stripping works,
  - invalid JSON throws,
  - schema mismatch throws,
  - catalog hallucination throws.

## Common pitfalls in this repo

- **Prompt arg parsing**: `src/cli.ts` filters out flags and their values; ensure new flags are filtered correctly so they don’t leak into the natural-language prompt.
- **Quoted commit messages / values**: `planner.ts` rule requires keeping message/value as a single `args` element.
- **Forced catalogs**: `--catalogs` must validate names and only enable those; don’t bypass validation.
- **Shebang + ESM**: don’t switch CLI output back to `.js` ESM; it will break on Windows/Node combos described in `tsup.config.ts`.

## When you should suggest user-facing docs updates

If you change flags, provider names, catalog behavior, or safety constraints, update:
- `README.md` help/options section
- `README.md` catalogs / allowed commands section

