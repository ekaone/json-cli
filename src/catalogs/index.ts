import { existsSync } from "fs";
import { resolve } from "path";
import type { CatalogModule } from "./base.js";
import { packageCatalog } from "./package.js";
import { gitCatalog } from "./git.js";
import { dockerCatalog } from "./docker.js";
import { fsCatalog } from "./fs.js";
import { shellCatalog } from "./shell.js";

// ---------------------------------------------------------------------------
// All available catalogs
// ---------------------------------------------------------------------------
const ALL_CATALOGS: CatalogModule[] = [
  packageCatalog,
  gitCatalog,
  dockerCatalog,
  fsCatalog,
  shellCatalog,
];

const CATALOG_MAP = new Map<string, CatalogModule>(
  ALL_CATALOGS.map((c) => [c.name, c]),
);

// ---------------------------------------------------------------------------
// Auto-detect active catalogs based on project structure
// ---------------------------------------------------------------------------
export function detectCatalogs(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
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

  // Auto-detect mode
  const active: CatalogModule[] = [];

  for (const catalog of ALL_CATALOGS) {
    // Always include catalogs with no detectors (fs, shell)
    if (catalog.detectors.length === 0) {
      active.push(catalog);
      continue;
    }

    // Check if any detector exists
    const detected = catalog.detectors.some((detector) => {
      const path = resolve(cwd, detector);
      return existsSync(path);
    });

    if (detected) {
      active.push(catalog);
    }
  }

  return active;
}

// ---------------------------------------------------------------------------
// Build prompt from active catalogs
// ---------------------------------------------------------------------------
export function buildCatalogPrompt(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
): string {
  const active = detectCatalogs(cwd, forcedCatalogs);
  const lines = active.map((catalog) => catalog.buildPrompt());
  return `Allowed command types and commands:\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Get all type enum values from active catalogs
// ---------------------------------------------------------------------------
export function getAllTypeEnums(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
): string[] {
  const active = detectCatalogs(cwd, forcedCatalogs);
  const types: string[] = [];
  for (const catalog of active) {
    types.push(...catalog.typeEnum);
  }
  return [...new Set(types)]; // dedupe
}

// ---------------------------------------------------------------------------
// Build command map for validation
// ---------------------------------------------------------------------------
export function buildCommandMap(
  cwd: string = process.cwd(),
  forcedCatalogs?: string[],
): Map<string, readonly string[] | ["any"]> {
  const active = detectCatalogs(cwd, forcedCatalogs);
  const map = new Map<string, readonly string[] | ["any"]>();

  for (const catalog of active) {
    for (const type of catalog.typeEnum) {
      map.set(type, catalog.commands);
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
  type CatalogModule,
  type Step,
  type Plan,
} from "./base.js";

// Export individual catalogs for advanced use
export { packageCatalog, gitCatalog, dockerCatalog, fsCatalog, shellCatalog };
