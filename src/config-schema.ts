/**
 * Configuration schema for the toolchain extension.
 *
 * ToolchainConfig is the user-facing schema (all fields optional).
 * ResolvedToolchainConfig is the internal schema (all fields required, defaults applied).
 */

export interface ToolchainConfig {
  enabled?: boolean;
  features?: {
    enforcePackageManager?: boolean;
    rewritePython?: boolean;
    preventBrew?: boolean;
    gitRebaseEditor?: boolean;
  };
  packageManager?: {
    selected?: "bun" | "pnpm" | "npm";
  };
}

export interface ResolvedToolchainConfig {
  enabled: boolean;
  features: {
    enforcePackageManager: boolean;
    rewritePython: boolean;
    preventBrew: boolean;
    gitRebaseEditor: boolean;
  };
  packageManager: {
    selected: "bun" | "pnpm" | "npm";
  };
}
