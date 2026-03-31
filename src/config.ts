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

import { ConfigLoader, type Migration } from "@aliou/pi-utils-settings";
import { isValidBashSourceMode } from "./utils/bash-source-mode";
import {
  isMissingBashSourceMode,
  isV0,
  migrateMissingBashSourceMode,
  migrateV0,
} from "./utils/migration";

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

const migrations: Migration<ToolchainConfig>[] = [
  {
    name: "v0-to-current",
    shouldRun: (config) => isV0(config),
    run: (config) => migrateV0(config),
  },
  {
    name: "add-bash-source-mode",
    shouldRun: (config) => isMissingBashSourceMode(config),
    run: (config) => migrateMissingBashSourceMode(config),
  },
];

function deepMerge(target: object, source: object): void {
  const t = target as Record<string, unknown>;
  const s = source as Record<string, unknown>;

  for (const key in s) {
    if (s[key] === undefined) continue;
    if (
      typeof s[key] === "object" &&
      !Array.isArray(s[key]) &&
      s[key] !== null
    ) {
      if (!t[key] || typeof t[key] !== "object") t[key] = {};
      deepMerge(t[key] as object, s[key] as object);
    } else {
      t[key] = s[key];
    }
  }
}

function validateResolvedConfig(
  config: ResolvedToolchainConfig,
): ResolvedToolchainConfig {
  if (!isValidBashSourceMode(config.bash.sourceMode)) {
    throw new Error(
      '[toolchain] Invalid config: bash.sourceMode must be "override-bash" or "composed-bash"',
    );
  }

  return config;
}

export function resolveToolchainConfig(
  config: ToolchainConfig | null | undefined,
): ResolvedToolchainConfig {
  const resolved = structuredClone(DEFAULT_CONFIG);
  if (config) {
    deepMerge(resolved, config);
  }
  return validateResolvedConfig(resolved);
}

export const configLoader = new ConfigLoader<
  ToolchainConfig,
  ResolvedToolchainConfig
>("toolchain", DEFAULT_CONFIG, {
  scopes: ["global", "local", "memory"],
  migrations,
  afterMerge: (resolved) => validateResolvedConfig(resolved),
});
