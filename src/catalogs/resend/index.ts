import type { CatalogModule, CommandDef } from "../base.js";

const resendCommands: readonly CommandDef[] = [
  {
    name: "emails",
    subcommands: ["send", "get", "list"],
    args: [
      { flag: "--from", required: true, valueHint: "onboarding@resend.dev" },
      {
        flag: "--to",
        required: true,
        multiple: true,
        valueHint: "user@example.com",
      },
      { flag: "--subject", required: true },
      { flag: "--html", conflictsWith: "--text" },
      { flag: "--text", conflictsWith: "--html" },
      { flag: "--reply-to", valueHint: "reply@example.com" },
      { flag: "--cc", multiple: true },
      { flag: "--bcc", multiple: true },
      { flag: "--json", default: true },
    ],
    forbiddenArgs: ["--api-key", "--token", "--key"],
    dangerous: true,
    description: "Send and manage emails",
  },
  {
    name: "domains",
    subcommands: ["create", "get", "list", "verify", "delete"],
    args: [
      { flag: "--name", required: true, valueHint: "example.com" },
      { flag: "--json", default: true },
    ],
    forbiddenArgs: ["--api-key", "--token"],
    description: "Manage email domains",
  },
  {
    name: "api-keys",
    subcommands: ["create", "list"],
    args: [
      { flag: "--name", required: true, valueHint: "my-api-key" },
      { flag: "--permission", valueHint: "restricted" },
      { flag: "--json", default: true },
    ],
    forbiddenArgs: ["--api-key", "--token"],
    description: "Manage API keys",
  },
  {
    name: "broadcasts",
    subcommands: ["create", "get", "list", "send", "delete"],
    args: [
      { flag: "--name", required: true },
      { flag: "--from", required: true, valueHint: "onboarding@resend.dev" },
      { flag: "--subject", required: true },
      { flag: "--html" },
      { flag: "--text" },
      { flag: "--json", default: true },
    ],
    forbiddenArgs: ["--api-key", "--token"],
    dangerous: true,
    description: "Manage broadcast emails",
  },
  {
    name: "contacts",
    subcommands: ["create", "get", "list", "delete"],
    args: [
      { flag: "--email", required: true, valueHint: "user@example.com" },
      { flag: "--audience-id", required: true, valueHint: "audience_id" },
      { flag: "--json", default: true },
    ],
    forbiddenArgs: ["--api-key", "--token"],
    description: "Manage contacts",
  },
  {
    name: "audiences",
    subcommands: ["create", "get", "list", "delete"],
    args: [
      { flag: "--name", required: true, valueHint: "My Audience" },
      { flag: "--json", default: true },
    ],
    forbiddenArgs: ["--api-key", "--token"],
    description: "Manage audiences",
  },
  {
    name: "webhooks",
    subcommands: ["create", "get", "list", "delete"],
    args: [
      {
        flag: "--endpoint",
        required: true,
        valueHint: "https://example.com/hook",
      },
      { flag: "--json", default: true },
    ],
    forbiddenArgs: ["--api-key", "--token"],
    description: "Manage webhooks",
  },
  {
    name: "templates",
    subcommands: ["create", "get", "list", "update", "delete"],
    args: [
      { flag: "--name", required: true },
      { flag: "--json", default: true },
    ],
    forbiddenArgs: ["--api-key", "--token"],
    description: "Manage email templates",
  },
  { name: "login" },
  { name: "logout" },
  { name: "doctor" },
];

export const resendCatalog: CatalogModule = {
  name: "resend",
  commands: resendCommands,
  detectors: [],
  triggers: [
    "email",
    "resend",
    "broadcast",
    "audience",
    "contact",
    "webhook",
    "template",
    "domain",
  ],
  typeEnum: ["resend"],
  buildPrompt() {
    const lines = resendCommands.map((cmd) => {
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
    return `  - resend:\n${lines.join("\n")}`;
  },
  agentDoc: `Output MUST be valid JSON only (no markdown).
- type MUST be "resend" for all steps in this catalog.
- command MUST be one of the allowed top-level commands.
- Everything after the top-level command goes into args[] as separate tokens.
- Never include secrets in args[] (no API keys, tokens, passwords). Auth comes from env vars or prior login.
- Prefer --json flag for non-interactive/automation output.
- Do not combine tokens. Example: Good: ["--subject", "Hello world"] Bad: ["--subject Hello world"]
- If a value contains spaces, keep it as a single element: "Hello world".`,
};
