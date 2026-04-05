import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ProviderName } from "./providers/index.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const JSON_CLI_DIR   = join(homedir(), ".json-cli");
const HISTORY_FILE   = join(JSON_CLI_DIR, "history.json");
const MAX_ENTRIES    = 50;
const DISPLAY_LIMIT  = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface HistoryEntry {
  id:        number;
  prompt:    string;
  provider:  ProviderName;
  steps:     number;
  success:   boolean;
  timestamp: string;
}

interface HistoryFile {
  entries: HistoryEntry[];
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
// Load history file
// ---------------------------------------------------------------------------
export function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    const data = JSON.parse(readFileSync(HISTORY_FILE, "utf-8")) as HistoryFile;
    return data.entries ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Append entry — keeps max 50, drops oldest
// ---------------------------------------------------------------------------
export function appendHistory(entry: Omit<HistoryEntry, "id">): void {
  ensureDir();
  const entries = loadHistory();
  const id = (entries[entries.length - 1]?.id ?? 0) + 1;
  entries.push({ id, ...entry });

  // keep only last MAX_ENTRIES
  const trimmed = entries.slice(-MAX_ENTRIES);
  writeFileSync(HISTORY_FILE, JSON.stringify({ entries: trimmed }, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Get last N entries for display (most recent first)
// ---------------------------------------------------------------------------
export function getRecentHistory(limit = DISPLAY_LIMIT): HistoryEntry[] {
  return loadHistory().slice(-limit).reverse();
}

// ---------------------------------------------------------------------------
// Clear all history
// ---------------------------------------------------------------------------
export function clearHistory(): void {
  ensureDir();
  writeFileSync(HISTORY_FILE, JSON.stringify({ entries: [] }, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Check if history exists
// ---------------------------------------------------------------------------
export function hasHistory(): boolean {
  return loadHistory().length > 0;
}
