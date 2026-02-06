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
    preventDockerSecrets?: boolean;
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
    preventDockerSecrets: boolean;
    gitRebaseEditor: boolean;
  };
  packageManager: {
    selected: "bun" | "pnpm" | "npm";
  };
}

import { ConfigLoader } from "@aliou/pi-utils-settings";

const DEFAULT_CONFIG: ResolvedToolchainConfig = {
  enabled: true,
  features: {
    enforcePackageManager: false,
    rewritePython: false,
    preventBrew: false,
    preventDockerSecrets: false,
    gitRebaseEditor: true,
  },
  packageManager: {
    selected: "pnpm",
  },
};

export const configLoader = new ConfigLoader<
  ToolchainConfig,
  ResolvedToolchainConfig
>("toolchain", DEFAULT_CONFIG, {
  scopes: ["global", "local", "memory"],
});
