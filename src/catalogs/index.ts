import { existsSync } from "fs";
import { resolve } from "path";
import type { CatalogModule } from "./base.js";
import { isCommandDefArray, getCommandNames } from "./base.js";
import { packageCatalog } from "./package/index.js";
import { gitCatalog } from "./git/index.js";
import { dockerCatalog } from "./docker/index.js";
import { fsCatalog } from "./fs/index.js";
import { shellCatalog } from "./shell/index.js";
import { vercelCatalog } from "./vercel/index.js";
import { resendCatalog } from "./resend/index.js";

// ---------------------------------------------------------------------------
// All available catalogs
// ---------------------------------------------------------------------------
const ALL_CATALOGS: CatalogModule[] = [
  packageCatalog,
  gitCatalog,
  dockerCatalog,
  fsCatalog,
  shellCatalog,
  vercelCatalog,
  resendCatalog,
];

const CATALOG_MAP = new Map<string, CatalogModule>(
  ALL_CATALOGS.map((c) => [c.name, c]),
);

// ---------------------------------------------------------------------------
// Auto-detect active catalogs based on project structure + user intent
// ---------------------------------------------------------------------------
export function detectCatalogs(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
  userPrompt?: string,
): CatalogModule[] {
  // If forced catalogs specified, validate and use only those
  if (forcedCatalogs && forcedCatalogs.length > 0) {
    const active: CatalogModule[] = [];
    for (const name of forcedCatalogs) {
      const catalog = CATALOG_MAP.get(name);
      if (!catalog) {
        const valid = Array.from(CATALOG_MAP.keys()).join(", ");
        throw new Error(`Unknown catalog "${name}". Valid: ${valid}`);
      }
      active.push(catalog);
    }
    return active;
  }

  // Auto-detect mode: detectors + triggers
  const active: CatalogModule[] = [];
  const lowerPrompt = userPrompt?.toLowerCase() ?? "";

  for (const catalog of ALL_CATALOGS) {
    // Always include catalogs with no detectors AND no triggers (fs, shell)
    if (catalog.detectors.length === 0 && !catalog.triggers) {
      active.push(catalog);
      continue;
    }

    // Detect via project files
    const detected = catalog.detectors.some((detector) => {
      const path = resolve(cwd, detector);
      return existsSync(path);
    });

    // Detect via user intent keywords
    const triggered = catalog.triggers
      ? catalog.triggers.some((t) => lowerPrompt.includes(t.toLowerCase()))
      : false;

    if (detected || triggered) {
      active.push(catalog);
    }
  }

  return active;
}

// ---------------------------------------------------------------------------
// Build prompt from active catalogs (Tier 1: command list, Tier 2: agentDoc)
// ---------------------------------------------------------------------------
export function buildCatalogPrompt(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
  userPrompt?: string,
): string {
  const active = detectCatalogs(cwd, forcedCatalogs, userPrompt);

  // Tier 1: always include command lists
  const lines = active.map((catalog) => catalog.buildPrompt());

  // Tier 2: only inject agentDoc for relevant catalogs
  const lowerPrompt = userPrompt?.toLowerCase() ?? "";
  const docs = active
    .filter((c) => {
      if (!c.agentDoc) return false;
      if (!c.triggers || !userPrompt) return true;
      return c.triggers.some((t) => lowerPrompt.includes(t.toLowerCase()));
    })
    .map((c) => `## ${c.name} rules\n${c.agentDoc}`);

  const prompt = `Allowed command types and commands:\n${lines.join("\n")}`;
  return docs.length > 0 ? `${prompt}\n\n${docs.join("\n\n")}` : prompt;
}

// ---------------------------------------------------------------------------
// Get all type enum values from active catalogs
// ---------------------------------------------------------------------------
export function getAllTypeEnums(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
  userPrompt?: string,
): string[] {
  const active = detectCatalogs(cwd, forcedCatalogs, userPrompt);
  const types: string[] = [];
  for (const catalog of active) {
    types.push(...catalog.typeEnum);
  }
  return [...new Set(types)]; // dedupe
}

// ---------------------------------------------------------------------------
// Build catalog map for validation (type → CatalogModule)
// ---------------------------------------------------------------------------
export function buildCatalogMap(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
  userPrompt?: string,
): Map<string, CatalogModule> {
  const active = detectCatalogs(cwd, forcedCatalogs, userPrompt);
  const map = new Map<string, CatalogModule>();

  for (const catalog of active) {
    for (const type of catalog.typeEnum) {
      map.set(type, catalog);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Build command name map for legacy use (type → command names)
// ---------------------------------------------------------------------------
export function buildCommandMap(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
  userPrompt?: string,
): Map<string, readonly string[] | ["any"]> {
  const active = detectCatalogs(cwd, forcedCatalogs, userPrompt);
  const map = new Map<string, readonly string[] | ["any"]>();

  for (const catalog of active) {
    const names = getCommandNames(catalog.commands);
    for (const type of catalog.typeEnum) {
      map.set(type, names as readonly string[] | ["any"]);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Re-export base types and functions
// ---------------------------------------------------------------------------
export {
  createStepSchema,
  createPlanSchema,
  validateStep,
  isCommandDefArray,
  getCommandNames,
  findCommandDef,
  type CatalogModule,
  type CommandArg,
  type CommandDef,
  type ValidationResult,
  type Step,
  type Plan,
} from "./base.js";

// Export individual catalogs for advanced use
export {
  packageCatalog,
  gitCatalog,
  dockerCatalog,
  fsCatalog,
  shellCatalog,
  vercelCatalog,
  resendCatalog,
};
