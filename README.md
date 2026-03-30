# json-cli

AI-powered CLI task runner. Describe your goal in plain English — AI generates a validated JSON command plan — runner executes it step by step.

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

```bash
export ANTHROPIC_API_KEY=your_key_here
```

> Windows PowerShell: `$env:ANTHROPIC_API_KEY="your_key_here"`

---

## Usage

### Single intent

```bash
json-cli "please run tests"
json-cli "please build"
json-cli "check git status"
```

### Multi-intent — the fun part 🔥

Chain multiple commands in plain English using **"then"**, **"and"**, **"after that"**:

```bash
json-cli "run tests and then build"
```

```bash
json-cli "run typecheck, test, and then check git status"
```

```bash
json-cli "please run dev with port 5000"
```

```bash
json-cli "install deps, run tests, then build"
```

### Full release flow in one command 🚀

```bash
json-cli "run tests, build, git add all, commit with message 'release v0.1.0', push, then publish"
```

```
📋 Plan (6 steps):
  1. pnpm test                → Run test suite
  2. pnpm build               → Build package
  3. git add .                → Stage all changes
  4. git commit -m "release v0.1.0"  → Commit release
  5. git push                 → Push to remote
  6. pnpm publish             → Publish to npm

Proceed? › y
```

### More crazy examples

```bash
# Full dev startup
json-cli "install deps and run dev on port 3000"

# Audit and fix
json-cli "run npm audit, then update all deps"

# Branch and commit workflow
json-cli "check git status, add all files, commit with message 'feat: add multi-intent support', then push"

# Test everything before shipping
json-cli "run typecheck, run tests, build, then publish"

# Clone and install
json-cli "clone https://github.com/ekaone/json-cli and then install deps"

# Check before commit
json-cli "run tests, check git diff, then git add and commit with message 'fix: catalog types'"

# Full CI-like flow locally
json-cli "install deps, run typecheck, run tests, build, git add, commit with message 'ci: local pipeline passed', push"
```

### Options

```bash
json-cli
# or
json-cli --help
```
```
┌  json-cli — AI-powered CLI task runner
│
│  Usage
│    json-cli "<your goal>" [options]
│
│  Options
│    --provider <name>   AI provider: claude | openai | ollama  (default: claude)
│    --yes               Skip confirmation prompt
│    --dry-run           Show plan without executing
│    --debug             Show system prompt and raw AI response
│    --help              Show this help message
│    --version, -v       Show version
│
│  Examples
│    json-cli "please run tests"
│    json-cli "run tests and build"
│    json-cli "run tests and build" --yes
│    json-cli "git add, commit with message 'fix: bug', push"
│    json-cli "clone https://github.com/user/repo, install deps, run dev"
│    json-cli "run tests and publish" --provider openai
│    json-cli "run tests" --dry-run
│    json-cli "run tests" --debug
│    json-cli "run tests" --debug --dry-run
│
└  Docs: https://github.com/ekaone/json-cli
```

---

## How it works

```
User Prompt (plain English)
    │
    ▼
AI Provider         ← Claude / OpenAI / Ollama
    │               extracts ALL intents, sequences them
    ▼
JSON Plan           ← validated by Zod schema (max 10 steps)
    │
    ▼
Catalog Check       ← whitelist prevents hallucinated commands
    │
    ▼
Confirm (y/n)       ← review the full plan before execution
    │
    ▼
Runner              ← executes step by step, streams output live
                       stops immediately on first failure
```

---

## Allowed commands

| Type    | Commands |
|---------|----------|
| `pnpm`  | install, run, build, test, publish, add, remove, update, dlx, why |
| `npm`   | install, run, build, test, publish, ci, init, outdated, audit |
| `yarn`  | install, run, build, test, publish, add, remove, why, upgrade |
| `bun`   | install, run, build, test, publish, add, remove, x, update |
| `git`   | init, add, commit, push, pull, clone, status, log, branch, checkout, merge, diff, stash |
| `fs`    | mkdir, touch, cp, mv, ls  `(coming soon)` |
| `shell` | any *(escape hatch — always requires extra confirmation)* |

> **Note:** Flags and arguments are unrestricted — `--port 5000`, `-m "message"`, `--force` etc. are all passed freely. Only the command itself is whitelisted.

---

## AI Providers

```bash
# Claude (default)
json-cli "run tests and build"

# OpenAI
json-cli "run tests and build" --provider openai

# Ollama (local, no API key needed)
json-cli "run tests and build" --provider ollama
```

## Environment variables

```bash
ANTHROPIC_API_KEY=sk-ant-...   # for Claude
OPENAI_API_KEY=sk-...          # for OpenAI
```

---

## Local development

```bash
pnpm install
pnpm dev "please run tests"
pnpm test
pnpm build
```

## Pricing

> **Note:** [Pricing](./src/providers/pricing.ts) is based on the lastest rates from each provider. Write an [issue](https://github.com/ekaone/json-cli/issues) if you find any outdated pricing.

| Provider | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) |
|----------|----------------------------|-----------------------------|
| Claude   | $3.00                      | $15.00                      |
| OpenAI   | $2.50                      | $10.00                      |
| Ollama   | $0.00                      | $0.00                       |

---

## License

MIT © [Eka Prasetia](https://prasetia.me/)

## Links

- [npm Package](https://www.npmjs.com/package/@ekaone/json-cli)
- [GitHub Repository](https://github.com/ekaone/json-cli)
- [Issue Tracker](https://github.com/ekaone/json-cli/issues)

⭐ If this library helps you, please consider giving it a star on GitHub!