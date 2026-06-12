import type { ResolvedToolchainConfig } from "./types";

export const DEFAULT_CONFIG: ResolvedToolchainConfig = {
  enabled: true,
  features: {
    enforcePackageManager: "disabled",
    rewritePython: "disabled",
    gitRebaseEditor: "rewrite",
  },
  packageManager: {
    selected: "pnpm",
  },
  bash: {
    sourceMode: "override-bash",
  },
  ui: {
    showRewriteNotifications: false,
  },
};
