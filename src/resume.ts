import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Plan } from "./catalog.js";
import type { ProviderName } from "./providers/index.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const JSON_CLI_DIR = join(homedir(), ".json-cli");
const RESUME_FILE  = join(JSON_CLI_DIR, "last-plan.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ResumeData {
  plan:      Plan;
  failedAt:  number; // step index (0-based) to resume from
  provider:  ProviderName;
  prompt:    string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Ensure ~/.json-cli/ exists
// ---------------------------------------------------------------------------
function ensureDir(): void {
  if (!existsSync(JSON_CLI_DIR)) {
    mkdirSync(JSON_CLI_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Save resume state after failure
// ---------------------------------------------------------------------------
export function saveResume(data: ResumeData): void {
  ensureDir();
  writeFileSync(RESUME_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Load resume state
// ---------------------------------------------------------------------------
export function loadResume(): ResumeData | null {
  if (!existsSync(RESUME_FILE)) return null;
  try {
    return JSON.parse(readFileSync(RESUME_FILE, "utf-8")) as ResumeData;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Clear resume state after success or manual clear
// ---------------------------------------------------------------------------
export function clearResume(): void {
  if (existsSync(RESUME_FILE)) {
    unlinkSync(RESUME_FILE);
  }
}

// ---------------------------------------------------------------------------
// Check if resume is available
// ---------------------------------------------------------------------------
export function hasResume(): boolean {
  return existsSync(RESUME_FILE);
}
