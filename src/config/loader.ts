import { ConfigLoader, type Migration } from "@aliou/pi-utils-settings";
import { DEFAULT_CONFIG } from "./defaults";
import {
  isMissingBashSourceMode,
  isV0,
  migrateMissingBashSourceMode,
  migrateRenameKeys,
  migrateV0,
  needsKeyRename,
} from "./migration";
import type { ResolvedToolchainConfig, ToolchainConfig } from "./types";

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
  {
    name: "rename-keys-and-mutate-mode",
    shouldRun: (config) => needsKeyRename(config),
    run: (config) => migrateRenameKeys(config),
  },
];

const VALID_FEATURE_MODES = new Set<string>(["disabled", "mutate", "block"]);

function isValidBashSourceMode(value: unknown): value is string {
  return value === "override-bash" || value === "composed-bash";
}

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

function assertFeatureMode(name: string, value: string): void {
  if (!VALID_FEATURE_MODES.has(value)) {
    throw new Error(
      `[toolchain] Invalid config: features.${name} must be "disabled", "mutate", or "block"`,
    );
  }
}

function validateResolvedConfig(
  config: ResolvedToolchainConfig,
): ResolvedToolchainConfig {
  assertFeatureMode("packageManager", config.features.packageManager);
  assertFeatureMode("python", config.features.python);
  assertFeatureMode("gitRebaseEditor", config.features.gitRebaseEditor);

  if (config.features.gitRebaseEditor === "block") {
    throw new Error(
      '[toolchain] Invalid config: features.gitRebaseEditor must be "disabled" or "mutate" (block is not supported)',
    );
  }

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
