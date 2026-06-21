/**
 * Migration 1: v0 boolean -> FeatureMode.
 *
 * v0 = any config without a version field (legacy). Converts boolean
 * feature toggles to FeatureMode strings ("mutate"|"disabled") and strips
 * features that moved to @aliou/pi-guardrails.
 *
 * Pure: takes a config, returns a migrated config with no side effects.
 * User-facing message is attached to the migration object below and is
 * emitted by ConfigLoader.drainMessages(). The message does NOT carry a
 * "[toolchain]" prefix — the extension's session_start handler adds it.
 *
 * Stamps CURRENT_VERSION — intentional since each migration gates on its
 * own shouldRun condition and is idempotent.
 */

import type { Migration } from "@aliou/pi-utils-settings";
import type { FeatureMode, ToolchainConfig } from "../types";
import { CURRENT_VERSION } from "./version";

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
      const mode: FeatureMode = val ? "mutate" : "disabled";
      migrated.features[key] = mode;
    }
  }

  // Strip removed features.
  for (const key of REMOVED_FEATURES) {
    delete migrated.features[key];
  }

  migrated.version = CURRENT_VERSION;

  return migrated as ToolchainConfig;
}

/** Build the migration message for v0. Receives the config before migration. */
export function v0Message(before: ToolchainConfig): string {
  const features = before.features as Record<string, unknown> | undefined;
  const removedFound: string[] = [];
  if (features) {
    for (const key of REMOVED_FEATURES) {
      if (key in features) removedFound.push(key);
    }
  }

  return (
    "Updated: feature options now support three modes: " +
    '"disabled", "mutate" (transparent command mutation), or "block" ' +
    "(block the command via tool_call). " +
    "Use /toolchain:settings to configure. " +
    (removedFound.length > 0
      ? `The following features were removed and stripped from your config: ${removedFound.join(", ")}. ` +
        "They are now available in @aliou/pi-guardrails " +
        "(/guardrails:settings > Examples > Dangerous command presets)."
      : "Note: preventBrew and preventDockerSecrets have been removed from pi-toolchain. " +
        "They are now available in @aliou/pi-guardrails " +
        "(/guardrails:settings > Examples > Dangerous command presets).")
  );
}

/** v0-to-current migration: boolean features -> FeatureMode, strip moved features. */
export const v0ToCurrentMigration: Migration<ToolchainConfig> = {
  name: "v0-to-current",
  shouldRun: (config) => isV0(config),
  run: (config) => migrateV0(config),
  message: (before) => v0Message(before),
};
