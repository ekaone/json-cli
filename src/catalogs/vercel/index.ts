import type { CatalogModule, CommandDef } from "../base.js";

const vercelCommands: readonly CommandDef[] = [
  {
    name: "deploy",
    args: [
      { flag: "--prod", valueHint: "deploy to production" },
      { flag: "--yes", default: true },
      { flag: "--json", default: true },
    ],
    dangerous: true,
    description: "Deploy to Vercel",
  },
  {
    name: "build",
    args: [],
    description: "Build project locally",
  },
  {
    name: "dev",
    args: [
      { flag: "--port", valueHint: "3000" },
      { flag: "--listen", valueHint: "tcp://..." },
    ],
    description: "Start local dev server",
  },
  {
    name: "pull",
    args: [
      { flag: "--environment", valueHint: "production|preview|development" },
      { flag: "--yes", default: true },
    ],
    description: "Sync env vars from Vercel",
  },
  {
    name: "env",
    subcommands: ["ls", "add", "rm", "pull", "copy"],
    args: [
      { flag: "--environment", valueHint: "production|preview|development" },
      { flag: "--json", default: true },
    ],
    description: "Manage environment variables",
  },
  {
    name: "logs",
    args: [
      { flag: "--output", valueHint: "json" },
      { flag: "--since", valueHint: "10m" },
    ],
    description: "View deployment logs",
  },
  {
    name: "link",
    args: [{ flag: "--yes", default: true }],
    description: "Link local project to Vercel",
  },
  {
    name: "login",
    args: [],
    description: "Login to Vercel",
  },
  {
    name: "logout",
    args: [],
    description: "Logout from Vercel",
  },
  {
    name: "list",
    args: [{ flag: "--json", default: true }],
    description: "List deployments",
  },
  {
    name: "inspect",
    args: [{ flag: "--json", default: true }],
    description: "Inspect a deployment",
  },
  {
    name: "promote",
    args: [],
    dangerous: true,
    description: "Promote a deployment to production",
  },
  {
    name: "domains",
    subcommands: ["ls", "add", "rm", "inspect"],
    args: [{ flag: "--json", default: true }],
    description: "Manage domains",
  },
  {
    name: "project",
    subcommands: ["ls", "add", "rm", "inspect"],
    args: [{ flag: "--json", default: true }],
    description: "Manage projects",
  },
];

export const vercelCatalog: CatalogModule = {
  name: "vercel",
  commands: vercelCommands,
  detectors: ["vercel.json", ".vercel"],
  triggers: [
    "deploy",
    "vercel",
    "serverless",
    "preview",
    "production",
    "env var",
    "env vars",
  ],
  typeEnum: ["vercel"],
  buildPrompt() {
    const lines = vercelCommands.map((cmd) => {
      const subs = cmd.subcommands ? ` (${cmd.subcommands.join("|")})` : "";
      const requiredArgs = (cmd.args || [])
        .filter((a) => a.required)
        .map((a) => `${a.flag} <${a.valueHint || "value"}>`)
        .join(" ");
      const optionalArgs = (cmd.args || [])
        .filter((a) => !a.required && !a.default)
        .map((a) => `[${a.flag} <${a.valueHint || "value"}>]`)
        .join(" ");
      return `    ${cmd.name}${subs}: ${requiredArgs} ${optionalArgs}`.trim();
    });
    return `  - vercel:\n${lines.join("\n")}`;
  },
  agentDoc: `Output MUST be valid JSON only (no markdown).
- type MUST be "vercel" for all steps in this catalog.
- command MUST be one of the allowed top-level commands.
- Everything after the top-level command goes into args[] as separate tokens.
- Never include secrets in args[] (no API keys, tokens, passwords). Auth comes from env vars or prior login.
- Prefer --json flag for non-interactive/automation output.
- Prefer --yes flag to skip interactive prompts.
- Do not combine tokens. Example: Good: ["--port", "3000"] Bad: ["--port 3000"]`,
};
