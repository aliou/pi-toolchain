import { ConfigLoader, type Migration } from "@aliou/pi-utils-settings";
import { DEFAULT_CONFIG } from "./defaults";
import {
  isMissingBashSourceMode,
  isV0,
  migrateMissingBashSourceMode,
  migrateV0,
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
];

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
