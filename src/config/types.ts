/**
 * Configuration schema for the toolchain extension.
 *
 * ToolchainConfig is the user-facing schema (all fields optional).
 * ResolvedToolchainConfig is the internal schema (all fields required, defaults applied).
 *
 * Feature modes:
 * - "disabled": feature is off
 * - "mutate": transparently mutate matching commands before shell execution
 * - "block": block matching commands via tool_call hook
 */

export type FeatureMode = "disabled" | "mutate" | "block";

export interface ToolchainConfig {
  version?: string;
  enabled?: boolean;
  features?: {
    packageManager?: FeatureMode;
    python?: FeatureMode;
    gitRebaseEditor?: FeatureMode;
  };
  packageManager?: {
    selected?: "bun" | "pnpm" | "npm";
  };
  ui?: {
    showMutationNotifications?: boolean;
  };
}

export interface ResolvedToolchainConfig {
  enabled: boolean;
  features: {
    packageManager: FeatureMode;
    python: FeatureMode;
    gitRebaseEditor: FeatureMode;
  };
  packageManager: {
    selected: "bun" | "pnpm" | "npm";
  };
  ui: {
    showMutationNotifications: boolean;
  };
}
