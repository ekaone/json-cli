import type { CatalogModule } from "../base.js";

export const packageCatalog: CatalogModule = {
  name: "package",
  commands: ["install", "run", "build", "test", "publish", "ci", "add", "remove"],
  detectors: ["package.json"],
  typeEnum: ["npm", "pnpm", "yarn", "bun"],
  buildPrompt() {
    return `  - npm: [${this.commands.join(", ")}]
  - pnpm: [${this.commands.join(", ")}]
  - yarn: [${this.commands.join(", ")}]
  - bun: [${this.commands.join(", ")}]`;
  },
};
