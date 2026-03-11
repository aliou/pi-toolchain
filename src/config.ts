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
  ui: {
    showRewriteNotifications: boolean;
  };
}

import { ConfigLoader, type Migration } from "@aliou/pi-utils-settings";
import { isV0, migrateV0 } from "./utils/migration";

const DEFAULT_CONFIG: ResolvedToolchainConfig = {
  enabled: true,
  features: {
    enforcePackageManager: "disabled",
    rewritePython: "disabled",
    gitRebaseEditor: "rewrite",
  },
  packageManager: {
    selected: "pnpm",
  },
  ui: {
    showRewriteNotifications: false,
  },
};

const migrations: Migration<ToolchainConfig>[] = [
  {
    name: "v0-to-current",
    shouldRun: (config) => isV0(config),
    run: (config) => migrateV0(config),
  },
];

export const configLoader = new ConfigLoader<
  ToolchainConfig,
  ResolvedToolchainConfig
>("toolchain", DEFAULT_CONFIG, {
  scopes: ["global", "local", "memory"],
  migrations,
});
