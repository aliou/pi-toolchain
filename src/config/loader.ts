import { ConfigLoader } from "@aliou/pi-utils-settings";
import { DEFAULT_CONFIG } from "./defaults";
import { migrations } from "./migration";
import type { ResolvedToolchainConfig, ToolchainConfig } from "./types";

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
  assertFeatureMode("nodePackageManager", config.features.nodePackageManager);
  assertFeatureMode("pythonToUv", config.features.pythonToUv);
  assertFeatureMode(
    "nonInteractiveGitRebase",
    config.features.nonInteractiveGitRebase,
  );

  if (config.features.nonInteractiveGitRebase === "block") {
    throw new Error(
      '[toolchain] Invalid config: features.nonInteractiveGitRebase must be "disabled" or "mutate" (block is not supported)',
    );
  }

  // Strip stale keys from old configs so they don't leak into resolved config
  delete (config as unknown as Record<string, unknown>).bash;
  delete (config.features as unknown as Record<string, unknown>).packageManager;
  delete (config.features as unknown as Record<string, unknown>).python;
  delete (config.features as unknown as Record<string, unknown>)
    .gitRebaseEditor;
  delete (config as unknown as Record<string, unknown>).packageManager;

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
