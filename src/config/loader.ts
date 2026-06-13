import { ConfigLoader, type Migration } from "@aliou/pi-utils-settings";
import { DEFAULT_CONFIG } from "./defaults";
import {
  hasStaleBashConfig,
  isV0,
  migrateRemoveBashConfig,
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
    name: "rename-keys-and-mutate-mode",
    shouldRun: (config) => needsKeyRename(config),
    run: (config) => migrateRenameKeys(config),
  },
  {
    name: "remove-bash-config",
    shouldRun: (config) => hasStaleBashConfig(config),
    run: (config) => migrateRemoveBashConfig(config),
  },
];

const VALID_FEATURE_MODES = new Set<string>(["disabled", "mutate", "block"]);

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

function sanitizeAndValidate(
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

  // Strip stale bash key from old configs so it doesn't leak into resolved config
  delete (config as unknown as Record<string, unknown>).bash;

  return config;
}

export function resolveToolchainConfig(
  config: ToolchainConfig | null | undefined,
): ResolvedToolchainConfig {
  const resolved = structuredClone(DEFAULT_CONFIG);
  if (config) {
    deepMerge(resolved, config);
  }
  return sanitizeAndValidate(resolved);
}

export const configLoader = new ConfigLoader<
  ToolchainConfig,
  ResolvedToolchainConfig
>("toolchain", DEFAULT_CONFIG, {
  scopes: ["global", "local", "memory"],
  migrations,
  afterMerge: (resolved) => sanitizeAndValidate(resolved),
});
