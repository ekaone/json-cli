import type { CatalogModule } from "../base.js";

export const gitCatalog: CatalogModule = {
  name: "git",
  commands: [
    "init",
    "add",
    "commit",
    "push",
    "pull",
    "clone",
    "status",
    "diff",
    "log",
    "branch",
    "checkout",
    "merge",
    "stash",
  ],
  detectors: [".git"],
  typeEnum: ["git"],
  buildPrompt() {
    return `  - git: [${this.commands.join(", ")}]`;
  },
};
