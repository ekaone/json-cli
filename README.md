# @ekaone/json-cli

AI-powered CLI task runner. Write plain English goals, get a validated JSON plan, then execute step-by-step.

## Think safety first

For safety, `json-cli`:
- generates a plan first
- validates schema + catalog rules + guardrails
- asks for confirmation before execution

Use `--dry-run` to preview the plan without executing commands.

## Installation

```bash
npm install -g @ekaone/json-cli
```

```bash
pnpm install -g @ekaone/json-cli
```

```bash
yarn global add @ekaone/json-cli
```

## Setup

Default provider is Claude when `--provider` is not set.

```bash
# Claude
export ANTHROPIC_API_KEY=your_key_here

# OpenAI
export OPENAI_API_KEY=your_key_here

# Ollama
export OLLAMA_BASE_URL=http://localhost:11434
```

Windows PowerShell:

```powershell
$env:ANTHROPIC_API_KEY="your_key_here"
```

## Usage

### Basic

```bash
json-cli "please run tests"
json-cli "please build"
json-cli "check git status"
```

### Multi-intent

```bash
json-cli "run tests and then build"
json-cli "run typecheck, test, and then check git status"
json-cli "run tests, check git diff, then git add and commit with message 'fix: catalog types'"
```

### Vercel + Resend examples

```bash
json-cli "deploy to vercel production" --catalogs vercel --dry-run --debug
json-cli "send email to ekaone@gmail.com from no-reply@support.com with subject 'Hello' and body 'How are you?'" --catalogs resend --dry-run --debug
json-cli "build app, deploy to vercel production, then send deployment email to ekaone@gmail.com" --catalogs package,vercel,resend --dry-run --debug
```

## Options

```text
json-cli "<your goal>" [options]

Alias:
  jc "<your goal>" [options]

Options:
  --provider <name>   AI provider: claude | openai | ollama  (default: claude)
  --catalogs <list>   Force specific catalogs: package,git,docker,fs,shell,vercel,resend (comma-separated)
  --yes               Skip confirmation prompt
  --dry-run           Show plan without executing
  --debug             Show system prompt and raw AI response
  --resume            Resume from last failed step
  --history           Browse and re-run past commands
  --history --clear   Clear command history
  --help              Show this help message
  --version, -v       Show version
```

## Catalogs (command whitelists)

`json-cli` auto-detects active catalogs from project files and prompt intent.

| Catalog | Auto-detected when | Types/commands |
|---|---|---|
| `package` | `package.json` exists | `npm`, `pnpm`, `yarn`, `bun` |
| `git` | `.git/` exists | git commands |
| `docker` | `Dockerfile` / compose file exists | docker commands |
| `fs` | always included | filesystem commands |
| `shell` | always included | any shell command (escape hatch) |
| `vercel` | `.vercel` / `vercel.json` exists or deploy-related intent | vercel commands |
| `resend` | email/resend-related intent | resend commands |

Force catalogs with `--catalogs`:

```bash
json-cli "deploy to prod" --catalogs vercel
json-cli "list files in E:" --catalogs fs
json-cli "build and deploy" --catalogs package,vercel
```

## How it works

```text
User prompt
  -> AI plan (JSON)
  -> Schema validation
  -> Catalog validation
  -> Guardrail validation
  -> Targeted repair loop (step-level, when needed)
  -> Confirm
  -> Execute step-by-step
```

## Targeted repair loop

If one step fails validation, `json-cli` repairs only the failing step (instead of regenerating the whole plan), then re-validates.

Flow:
1. detect failing step + exact reason
2. ask AI to repair that step only (catalog-scoped)
3. validate again
4. continue or fail clearly after retry limit

## Allowed command sets

| Type | Commands |
|---|---|
| `npm` | install, run, build, test, publish, ci, add, remove |
| `pnpm` | install, run, build, test, publish, ci, add, remove |
| `yarn` | install, run, build, test, publish, ci, add, remove |
| `bun` | install, run, build, test, publish, ci, add, remove |
| `git` | init, add, commit, push, pull, clone, status, diff, log, branch, checkout, merge, stash |
| `docker` | build, run, compose, push, pull, exec, logs, ps, stop, start, rm, rmi |
| `fs` | mkdir, rm, cp, mv, touch, cat, ls, dir |
| `vercel` | deploy, build, dev, pull, env, logs, link, login, logout, list, inspect, promote, domains, project |
| `resend` | emails, domains, api-keys, broadcasts, contacts, audiences, webhooks, templates, login, logout, doctor |
| `shell` | any command (escape hatch) |

Notes:
- Commands are whitelisted per catalog.
- Some catalogs enforce required/conflicting/forbidden flags.
- Guardrails block obvious secret leakage and malformed flags.

## AI providers

```bash
# Claude (default)
json-cli "run tests and build"

# OpenAI
json-cli "run tests and build" --provider openai

# Ollama
json-cli "run tests and build" --provider ollama
```

## Local development

```bash
pnpm install
pnpm dev "please run tests"
pnpm typecheck
pnpm test
pnpm build
```

## Pricing

Pricing config is in [`src/providers/pricing.ts`](./src/providers/pricing.ts). Open an issue if rates are outdated.

| Provider | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---:|---:|
| Claude | $3.00 | $15.00 |
| OpenAI | $2.50 | $10.00 |
| Ollama | $0.00 | $0.00 |

## License

MIT © [Eka Prasetia](./LICENSE)

## Links

- [npm package](https://www.npmjs.com/package/@ekaone/json-cli)
- [GitHub repository](https://github.com/ekaone/json-cli)
- [Issue tracker](https://github.com/ekaone/json-cli/issues)
