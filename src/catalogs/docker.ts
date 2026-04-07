import type { CatalogModule } from "./base.js";

export const dockerCatalog: CatalogModule = {
  name: "docker",
  commands: [
    "build",
    "run",
    "compose",
    "push",
    "pull",
    "exec",
    "logs",
    "ps",
    "stop",
    "start",
    "rm",
    "rmi",
  ],
  detectors: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
  typeEnum: ["docker"],
  buildPrompt() {
    return `  - docker: [${this.commands.join(", ")}]`;
  },
};
