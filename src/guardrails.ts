import type { Step } from "./catalogs/index.js";

// ---------------------------------------------------------------------------
// Generic, CLI-agnostic sanity checks
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  /--api-key\b/i,
  /--token\b/i,
  /--password\b/i,
  /--secret\b/i,
  /--key\b/i,
  /\bsk-[a-zA-Z0-9]{20,}\b/, // OpenAI-style keys
  /\bre_[a-zA-Z0-9]{20,}\b/, // Resend-style keys
  /\bghp_[a-zA-Z0-9]{30,}\b/, // GitHub PATs
  /\bxox[bpas]-[a-zA-Z0-9-]+\b/, // Slack tokens
];

const DANGEROUS_KEYWORDS = [
  /\bdeploy\b/i,
  /\bpublish\b/i,
  /\bsend\b/i,
  /\bdelete\b/i,
  /\bremove\b/i,
  /\bdestroy\b/i,
  /\bpush\b.*\b--force\b/i,
  /\bdrop\b/i,
  /\bpurge\b/i,
  /\boverwrite\b/i,
];

const MAX_ARG_LENGTH = 500;
const SHORT_FLAG_PATTERN = /^-[a-zA-Z0-9]{1,3}$/;

export interface GuardrailResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function applyGuardrails(steps: Step[]): GuardrailResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const step of steps) {
    // 1. No secrets in args
    for (const arg of step.args) {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(arg)) {
          errors.push(
            `Step ${step.id}: potential secret detected in args ("${arg.slice(0, 30)}...") - secrets should come from env vars or prior login`,
          );
        }
      }
    }

    // 2. Flag shape sanity
    for (const arg of step.args) {
      // Allow standard short flags (-m, -p, -am). Reject malformed single-dash long flags (-message).
      if (
        arg.startsWith("-") &&
        !arg.startsWith("--") &&
        !SHORT_FLAG_PATTERN.test(arg)
      ) {
        errors.push(
          `Step ${step.id}: malformed single-dash flag "${arg}" - use short flags like -m or long flags like --message`,
        );
      }
      // No giant inline blobs
      if (arg.length > MAX_ARG_LENGTH) {
        warnings.push(
          `Step ${step.id}: arg exceeds ${MAX_ARG_LENGTH} chars - consider using a file or env var instead`,
        );
      }
    }

    // 3. High-impact confirmation
    const cmdStr = `${step.command} ${step.args.join(" ")}`.toLowerCase();
    for (const pattern of DANGEROUS_KEYWORDS) {
      if (pattern.test(cmdStr)) {
        warnings.push(
          `Step ${step.id}: potentially destructive action ("${step.command}") - review carefully`,
        );
        break; // one warning per step is enough
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
