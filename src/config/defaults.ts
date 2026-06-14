import type { ResolvedToolchainConfig } from "./types";

export const DEFAULT_CONFIG: ResolvedToolchainConfig = {
  enabled: true,
  features: {
    nodePackageManager: "disabled",
    pythonToUv: "disabled",
    nonInteractiveGitRebase: "mutate",
  },
  nodePackageManager: {
    selected: "pnpm",
  },
  ui: {
    showMutationNotifications: false,
  },
};
