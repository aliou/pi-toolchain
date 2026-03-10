/**
 * Config migration for the toolchain extension.
 *
 * Uses a version field to gate migrations, following the same pattern as
 * pi-guardrails. Configs without a version field are considered v0 (legacy).
 *
 * v0 -> current:
 * - features.enforcePackageManager: boolean -> FeatureMode
 * - features.rewritePython: boolean         -> FeatureMode
 * - features.gitRebaseEditor: boolean       -> FeatureMode
 * - features.preventBrew: removed (warn to use pi-guardrails)
 * - features.preventDockerSecrets: removed (warn to use pi-guardrails)
 */

import type { FeatureMode, ToolchainConfig } from "../config";

/**
 * Config schema version. Bump only when a migration is added.
 * Keep independent from package.json version.
 */
export const CURRENT_VERSION = "0.4.0-20260310";

/** Warnings queued during migration, flushed at session_start. */
export const pendingWarnings: string[] = [];

const LEGACY_BOOLEAN_FEATURES = [
  "enforcePackageManager",
  "rewritePython",
  "gitRebaseEditor",
] as const;

const REMOVED_FEATURES = ["preventBrew", "preventDockerSecrets"] as const;

/** v0 = any config without a version field. */
export function isV0(config: ToolchainConfig): boolean {
  return (config as Record<string, unknown>).version === undefined;
}

export function migrateV0(config: ToolchainConfig): ToolchainConfig {
  const migrated = structuredClone(config) as Record<string, unknown> & {
    features: Record<string, unknown>;
  };

  if (!migrated.features) migrated.features = {};

  // Migrate boolean features to FeatureMode strings.
  for (const key of LEGACY_BOOLEAN_FEATURES) {
    const val = migrated.features[key];
    if (typeof val === "boolean") {
      const mode: FeatureMode = val ? "rewrite" : "disabled";
      migrated.features[key] = mode;
    }
  }

  // Strip removed features and warn.
  const removedFound: string[] = [];
  for (const key of REMOVED_FEATURES) {
    if (key in migrated.features) {
      delete migrated.features[key];
      removedFound.push(key);
    }
  }

  // Always show an update notice on first run after upgrading.
  // The migration runs exactly once per config file (version is stamped below),
  // so this message will never appear more than once per scope.
  pendingWarnings.push(
    "[toolchain] Updated: feature options now support three modes: " +
      '"disabled", "rewrite" (transparent command rewriting), or "block" ' +
      "(block the command via tool_call without overriding the bash tool). " +
      "Use /toolchain:settings to configure. " +
      (removedFound.length > 0
        ? `The following features were removed and stripped from your config: ${removedFound.join(", ")}. ` +
          "They are now available in @aliou/pi-guardrails " +
          "(/guardrails:settings > Examples > Dangerous command presets)."
        : "Note: preventBrew and preventDockerSecrets have been removed from pi-toolchain. " +
          "They are now available in @aliou/pi-guardrails " +
          "(/guardrails:settings > Examples > Dangerous command presets)."),
  );

  migrated.version = CURRENT_VERSION;
  return migrated as ToolchainConfig;
}
