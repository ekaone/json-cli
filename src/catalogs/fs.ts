import type { CatalogModule } from "./base.js";

export const fsCatalog: CatalogModule = {
  name: "fs",
  commands: ["mkdir", "rm", "cp", "mv", "touch", "cat", "ls"],
  detectors: [],
  typeEnum: ["fs"],
  buildPrompt() {
    return `  - fs: [${this.commands.join(", ")}]`;
  },
};
