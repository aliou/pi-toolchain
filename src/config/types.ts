/**
 * Configuration schema for the toolchain extension.
 *
 * ToolchainConfig is the user-facing schema (all fields optional).
 * ResolvedToolchainConfig is the internal schema (all fields required, defaults applied).
 *
 * Feature modes:
 * - "disabled": feature is off
 * - "rewrite": transparently rewrite matching commands via spawn hook
 * - "block": block matching commands via tool_call hook (bash tool not overridden)
 */

export type FeatureMode = "disabled" | "rewrite" | "block";
export type BashSourceMode = "override-bash" | "composed-bash";

export interface ToolchainConfig {
  version?: string;
  enabled?: boolean;
  features?: {
    enforcePackageManager?: FeatureMode;
    rewritePython?: FeatureMode;
    gitRebaseEditor?: FeatureMode;
  };
  packageManager?: {
    selected?: "bun" | "pnpm" | "npm";
  };
  bash?: {
    sourceMode?: BashSourceMode;
  };
  ui?: {
    showRewriteNotifications?: boolean;
  };
}

export interface ResolvedToolchainConfig {
  enabled: boolean;
  features: {
    enforcePackageManager: FeatureMode;
    rewritePython: FeatureMode;
    gitRebaseEditor: FeatureMode;
  };
  packageManager: {
    selected: "bun" | "pnpm" | "npm";
  };
  bash: {
    sourceMode: BashSourceMode;
  };
  ui: {
    showRewriteNotifications: boolean;
  };
}
