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

## Usage 

```
export ANTHROPIC_API_KEY=your_key_here
```


```bash
// Single intent
json-cli "please run tests"
```

```bash
// Multiple intents
json-cli "please run tests and build"

OR

```bash
json-cli "heyy ... run typecheck, test and then check git status"
```

### For local development

```bash
pnpm install
```

### Usage

```bash
# Using Claude (default)
pnpm dev "install deps and run tests"

# Using OpenAI
pnpm dev "run build and publish" --provider openai

# Using Ollama (local)
pnpm dev "start dev server" --provider ollama
```

## How it works

```
User Prompt
    │
    ▼
AI Provider         ← Claude / OpenAI / Ollama
    │
    ▼
JSON Plan           ← validated by Zod schema
    │
    ▼
Catalog Check       ← whitelist prevents hallucinated commands
    │
    ▼
Confirm (y/n)       ← user reviews before execution
    │
    ▼
Runner              ← executes steps, streams output live
```

## Allowed commands

| Type  | Commands |
|-------|----------|
| pnpm  | install, run, build, test, publish, add, remove |
| npm   | install, run, build, test, publish, ci |
| yarn  | install, run, build, test, publish, add, remove |
| bun   | install, run, build, test, publish, add, remove |
| git   | init, add, commit, push, pull, clone, status, log |
| shell | any *(requires extra caution)* |

## Environment variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## Run tests

```bash
pnpm test
```

## License

MIT © [Eka Prasetia](https://prasetia.me/)

## Links

- [npm Package](https://www.npmjs.com/package/@ekaone/json-cli)
- [GitHub Repository](https://github.com/ekaone/json-cli)
- [Issue Tracker](https://github.com/ekaone/json-cli/issues)

⭐ If this library helps you, please consider giving it a star on GitHub!
