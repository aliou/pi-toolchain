import type { ResolvedToolchainConfig } from "./types";

export const DEFAULT_CONFIG: ResolvedToolchainConfig = {
  enabled: true,
  features: {
    packageManager: "disabled",
    python: "disabled",
    gitRebaseEditor: "mutate",
  },
  packageManager: {
    selected: "pnpm",
  },
  bash: {
    sourceMode: "override-bash",
  },
  ui: {
    showMutationNotifications: false,
  },
};
