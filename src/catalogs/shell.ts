import type { CatalogModule } from "./base.js";

export const shellCatalog: CatalogModule = {
  name: "shell",
  commands: ["any"],
  detectors: [],
  typeEnum: ["shell"],
  buildPrompt() {
    return `  - shell: [any shell command (use sparingly)]`;
  },
};
