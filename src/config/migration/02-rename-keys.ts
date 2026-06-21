/**
 * Migration 2: rename keys + "rewrite" -> "mutate".
 *
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
 *
 * Pure: takes a config, returns a migrated config with no side effects.
 * Stamps CURRENT_VERSION — intentional since each migration gates on its
 * own shouldRun condition and is idempotent.
 */

import type { Migration } from "@aliou/pi-utils-settings";
import type { ToolchainConfig } from "../types";
import { CURRENT_VERSION } from "./version";

/** Maps legacy feature values to current modes. Passes all other values
 *  through (including invalid ones) so validation can reject them. */
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

/**
 * Migrates old and intermediate config keys to the current schema. See
 * module docstring for the full list of renames.
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

  next.version = CURRENT_VERSION;

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

/** rename-keys-and-mutate-mode migration: collapses legacy/intermediate keys. */
export const renameKeysMigration: Migration<ToolchainConfig> = {
  name: "rename-keys-and-mutate-mode",
  shouldRun: (config) => needsKeyRename(config),
  run: (config) => migrateRenameKeys(config),
  message:
    "Config updated: feature keys and mode names have been renamed " +
    '("mutate" replaces "rewrite", keys simplified). ' +
    "Use /toolchain:settings to configure.",
};
