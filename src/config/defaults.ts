import type { ResolvedToolchainConfig } from "./types";

export const DEFAULT_CONFIG: ResolvedToolchainConfig = {
  enabled: true,
  features: {
    nodePackageManager: "disabled",
    pythonToPython3: "disabled",
    pythonToUv: "disabled",
    nonInteractiveGitRebase: "mutate",
    nixShell: "disabled",
  },
  nodePackageManager: {
    selected: "pnpm",
  },
  ui: {
    showMutationNotifications: false,
  },
};
