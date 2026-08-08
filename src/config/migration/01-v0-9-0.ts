/**
 * Migration 0.9.0: compose legacy migrations shipped in v0.9.0.
 *
 * The legacy migrations 01 (v0 -> FeatureMode), 02 (rename keys +
 * "rewrite" -> "mutate"), and 03 (remove bash config) all shipped in
 * pi-toolchain@0.9.0. In 0.10.1 we adopted pi-utils-settings versioned
 * migrations and composed them into a single semver migration.
 *
 * Pure: takes a config, returns a migrated config with no side effects.
 * User-facing message is attached to the migration object below and is
 * emitted by ConfigLoader.drainMessages(). The message does NOT carry a
 * "[toolchain]" prefix — the extension's session_start handler adds it.
 */

import type { Migration } from "@aliou/pi-utils-settings";
import type { FeatureMode, ToolchainConfig } from "../types";

const LEGACY_BOOLEAN_FEATURES = [
  "enforcePackageManager",
  "rewritePython",
  "gitRebaseEditor",
] as const;

const REMOVED_FEATURES = ["preventBrew", "preventDockerSecrets"] as const;

/** Intermediate keys that the rename migration previously produced. */
const STALE_FEATURE_KEYS: Record<string, string> = {
  packageManager: "nodePackageManager",
  python: "pythonToUv",
  gitRebaseEditor: "nonInteractiveGitRebase",
};

/** Original v0 keys that the rename migration must handle. */
const LEGACY_FEATURE_KEYS: Record<string, string> = {
  enforcePackageManager: "nodePackageManager",
  rewritePython: "pythonToUv",
};

/** v0 = any config without a version field or with a pre-semver stamp. */
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

  return migrated as ToolchainConfig;
}

/** Build the migration message for v0. Receives the config before migration. */
export function v0Message(before: ToolchainConfig): string | undefined {
  const features = before.features as Record<string, unknown> | undefined;
  const removedFound: string[] = [];
  if (features) {
    for (const key of REMOVED_FEATURES) {
      if (key in features) removedFound.push(key);
    }
  }

  // v0Message is only meaningful when the config is actually v0.
  if (!isV0(before)) return undefined;

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

/** Migrate legacy FeatureMode values. Passes others through for validation. */
function migrateFeatureModeValue(value: unknown): unknown {
  if (value === "rewrite") return "mutate";
  if (typeof value === "boolean") return value ? "mutate" : "disabled";
  return value;
}

/**
 * Moves a feature key from oldName to newName, migrating the value.
 * If both old and new exist, new takes precedence (already renamed).
 */
function moveFeatureKey(
  features: Record<string, unknown>,
  oldKey: string,
  newKey: string,
): void {
  if (features[newKey] === undefined && features[oldKey] !== undefined) {
    features[newKey] = migrateFeatureModeValue(features[oldKey]);
  } else if (features[newKey] !== undefined) {
    features[newKey] = migrateFeatureModeValue(features[newKey]);
  }
  delete features[oldKey];
}

/**
 * Migrates old and intermediate config keys to the current schema:
 * - features.enforcePackageManager -> features.nodePackageManager
 * - features.packageManager        -> features.nodePackageManager
 * - features.rewritePython         -> features.pythonToUv
 * - features.python                -> features.pythonToUv
 * - features.gitRebaseEditor       -> features.nonInteractiveGitRebase
 * - FeatureMode "rewrite"          -> "mutate"
 * - legacy booleans                -> FeatureMode values
 * - ui.showRewriteNotifications    -> ui.showMutationNotifications
 * - packageManager.selected        -> nodePackageManager.selected
 */
export function migrateRenameKeys(config: ToolchainConfig): ToolchainConfig {
  const next = structuredClone(config);

  next.features ??= {};
  const features = next.features as Record<string, unknown>;

  // Migrate legacy keys (v0 era)
  for (const [oldKey, newKey] of Object.entries(LEGACY_FEATURE_KEYS)) {
    moveFeatureKey(features, oldKey, newKey);
  }

  // Migrate intermediate keys (pre-release rename era)
  for (const [oldKey, newKey] of Object.entries(STALE_FEATURE_KEYS)) {
    moveFeatureKey(features, oldKey, newKey);
  }

  // nonInteractiveGitRebase: just migrate value if present
  if (features.nonInteractiveGitRebase !== undefined) {
    features.nonInteractiveGitRebase = migrateFeatureModeValue(
      features.nonInteractiveGitRebase,
    );
  }

  // ui.showRewriteNotifications -> ui.showMutationNotifications
  next.ui ??= {};
  const ui = next.ui as Record<string, unknown>;

  if (
    ui.showMutationNotifications === undefined &&
    ui.showRewriteNotifications !== undefined
  ) {
    ui.showMutationNotifications = ui.showRewriteNotifications;
  }
  delete ui.showRewriteNotifications;

  // packageManager.selected -> nodePackageManager.selected
  const topLevel = next as Record<string, unknown>;
  if (topLevel.packageManager !== undefined) {
    if (topLevel.nodePackageManager === undefined) {
      topLevel.nodePackageManager = topLevel.packageManager;
    }
    delete topLevel.packageManager;
  }

  return next;
}

/** Detects whether a config still carries pre-rename keys or values. */
export function needsKeyRename(config: ToolchainConfig): boolean {
  const features = config.features as Record<string, unknown> | undefined;
  const ui = config.ui as Record<string, unknown> | undefined;
  const topLevel = config as Record<string, unknown>;

  if (features) {
    // Legacy keys
    if ("enforcePackageManager" in features || "rewritePython" in features) {
      return true;
    }
    // Stale intermediate keys
    if (
      "packageManager" in features ||
      "python" in features ||
      "gitRebaseEditor" in features
    ) {
      return true;
    }
    // Leftover legacy mode values
    for (const val of Object.values(features)) {
      if (val === "rewrite" || typeof val === "boolean") return true;
    }
  }

  if (ui && "showRewriteNotifications" in ui) {
    return true;
  }

  if ("packageManager" in topLevel) {
    return true;
  }

  return false;
}

/** Detects stale bash key in user config. */
export function hasStaleBashConfig(config: ToolchainConfig): boolean {
  return "bash" in (config as Record<string, unknown>);
}

/** Strips stale bash key from user config. */
export function migrateRemoveBashConfig(
  config: ToolchainConfig,
): ToolchainConfig {
  const next = structuredClone(config) as Record<string, unknown>;
  delete next.bash;
  return next as ToolchainConfig;
}

/**
 * Detects whether the config needs the composed 0.9.0 migration.
 * This includes v0 configs, configs with stale or renamed keys, configs
 * with the removed bash key, and configs missing nixShell (which was added
 * in 0.9.0 along with these changes).
 */
export function needs090Migration(config: ToolchainConfig): boolean {
  return (
    isV0(config) ||
    needsKeyRename(config) ||
    hasStaleBashConfig(config) ||
    !(config.features as Record<string, unknown>)?.nixShell
  );
}

/** Composed migration shipped in pi-toolchain@0.9.0. */
export const v090Migration: Migration<ToolchainConfig> = {
  name: "v0-9-0",
  version: "0.9.0",
  shouldRun: (config) => needs090Migration(config),
  run: (config) => {
    let migrated = config;
    if (isV0(migrated)) {
      migrated = migrateV0(migrated);
    }
    if (needsKeyRename(migrated)) {
      migrated = migrateRenameKeys(migrated);
    }
    if (hasStaleBashConfig(migrated)) {
      migrated = migrateRemoveBashConfig(migrated);
    }

    // Backfill nixShell default if missing (added in 0.9.0).
    const features = (migrated as Record<string, unknown>).features as Record<
      string,
      unknown
    >;
    if (!("nixShell" in features)) {
      features.nixShell = "disabled";
    }

    return migrated;
  },
  message: (before) => v0Message(before),
};
