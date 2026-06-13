/**
 * Config migration for the toolchain extension.
 *
 * Uses a version field to gate migrations, following the same pattern as
 * pi-guardrails. Configs without a version field are considered v0 (legacy).
 *
 * Migrations (in order):
 *
 * 1. v0-to-current:
 *    - features.enforcePackageManager: boolean -> FeatureMode ("mutate"|"disabled")
 *    - features.rewritePython: boolean         -> FeatureMode
 *    - features.gitRebaseEditor: boolean       -> FeatureMode
 *    - features.preventBrew: removed (warn to use pi-guardrails)
 *    - features.preventDockerSecrets: removed (warn to use pi-guardrails)
 *
 * 2. rename-keys-and-mutate-mode:
 *    - features.enforcePackageManager -> features.packageManager
 *    - features.rewritePython         -> features.python
 *    - FeatureMode "rewrite"          -> "mutate"
 *    - ui.showRewriteNotifications    -> ui.showMutationNotifications
 *
 * 3. remove-bash-config:
 *    - Strips stale bash.sourceMode from user configs
 *    - Bash integration removed; tool_call is now the only runtime hook
 *
 * Note: migrations run in sequence. v0-to-current produces old key names
 * with "mutate" mode; rename-keys-and-mutate-mode then fixes the keys.
 * remove-bash-config cleans up the removed bash config surface.
 * All stamp CURRENT_VERSION — this is intentional since each migration
 * gates on its own shouldRun condition and is idempotent.
 */

import type { FeatureMode, ToolchainConfig } from "./types";

/**
 * Config schema version. Bump only when a migration is added.
 * Keep independent from package.json version.
 */
export const CURRENT_VERSION = "0.7.0-20260612";

/** Warnings queued during migration, flushed at session_start. */
export const pendingWarnings: string[] = [];

// --- 1. v0: boolean -> FeatureMode ---

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

  // Strip removed features and warn.
  const removedFound: string[] = [];
  for (const key of REMOVED_FEATURES) {
    if (key in migrated.features) {
      delete migrated.features[key];
      removedFound.push(key);
    }
  }

  migrated.version = CURRENT_VERSION;

  pendingWarnings.push(
    "[toolchain] Updated: feature options now support three modes: " +
      '"disabled", "mutate" (transparent command mutation), or "block" ' +
      "(block the command via tool_call). " +
      "Use /toolchain:settings to configure. " +
      (removedFound.length > 0
        ? `The following features were removed and stripped from your config: ${removedFound.join(", ")}. ` +
          "They are now available in @aliou/pi-guardrails " +
          "(/guardrails:settings > Examples > Dangerous command presets)."
        : "Note: preventBrew and preventDockerSecrets have been removed from pi-toolchain. " +
          "They are now available in @aliou/pi-guardrails " +
          "(/guardrails:settings > Examples > Dangerous command presets)."),
  );

  return migrated as ToolchainConfig;
}

// --- 2. rename keys + "rewrite" -> "mutate" ---

/** Maps legacy "rewrite" mode to "mutate". Passes all other values through
 *  (including invalid ones) so validation can reject them. */
function migrateFeatureModeValue(value: unknown): unknown {
  if (value === "rewrite") return "mutate";
  return value;
}

/** Moves a feature key from oldName to newName, migrating the value. */
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
 * Migrates old config surface to the current schema:
 * - features.enforcePackageManager -> features.packageManager
 * - features.rewritePython         -> features.python
 * - FeatureMode "rewrite"          -> "mutate"
 * - ui.showRewriteNotifications     -> ui.showMutationNotifications
 */
export function migrateRenameKeys(config: ToolchainConfig): ToolchainConfig {
  const next = structuredClone(config);

  next.features ??= {};
  const features = next.features as Record<string, unknown>;

  moveFeatureKey(features, "enforcePackageManager", "packageManager");
  moveFeatureKey(features, "rewritePython", "python");

  // gitRebaseEditor: just migrate value
  if (features.gitRebaseEditor !== undefined) {
    features.gitRebaseEditor = migrateFeatureModeValue(
      features.gitRebaseEditor,
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

  next.version = CURRENT_VERSION;

  pendingWarnings.push(
    "[toolchain] Config updated: feature keys and mode names have been renamed " +
      '("mutate" replaces "rewrite", keys simplified). ' +
      "Use /toolchain:settings to configure.",
  );

  return next;
}

export function needsKeyRename(config: ToolchainConfig): boolean {
  const features = config.features as Record<string, unknown> | undefined;
  const ui = config.ui as Record<string, unknown> | undefined;

  if (features) {
    if ("enforcePackageManager" in features || "rewritePython" in features) {
      return true;
    }

    // Check for leftover "rewrite" mode values
    for (const val of Object.values(features)) {
      if (val === "rewrite") return true;
    }
  }

  if (ui && "showRewriteNotifications" in ui) {
    return true;
  }

  return false;
}

// --- 3. remove-bash-config ---

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
  next.version = CURRENT_VERSION;

  pendingWarnings.push(
    "[toolchain] Removed stale bash.sourceMode config — " +
      "bash integration has been removed. " +
      "Use /toolchain:settings to configure.",
  );

  return next as ToolchainConfig;
}
