/**
 * Config migration for the toolchain extension.
 *
 * Uses a version field to gate migrations, following the same pattern as
 * pi-guardrails. Configs without a version field are considered v0 (legacy).
 *
 * All migration functions are pure: they take a config and return a migrated
 * config with no side effects. User-facing messages are declared in the
 * migration objects in loader.ts via the `message` field, and are emitted
 * by ConfigLoader.drainMessages(). The message strings do NOT carry a
 * "[toolchain]" prefix — the extension's session_start handler adds it when
 * building the single notification.
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
 *    - features.enforcePackageManager -> features.nodePackageManager
 *    - features.packageManager       -> features.nodePackageManager
 *    - features.rewritePython         -> features.pythonToUv
 *    - features.python                -> features.pythonToUv
 *    - features.gitRebaseEditor       -> features.nonInteractiveGitRebase
 *    - FeatureMode "rewrite"          -> "mutate"
 *    - legacy booleans                -> FeatureMode values
 *    - ui.showRewriteNotifications    -> ui.showMutationNotifications
 *    - packageManager.selected        -> nodePackageManager.selected
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

import type { FeatureMode, ToolchainConfig } from "../types";

/**
 * Config schema version. Bump only when a migration is added.
 * Keep independent from package.json version.
 */
export const CURRENT_VERSION = "0.8.1-20260619";

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

// --- 2. rename keys + "rewrite" -> "mutate" ---

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
 * Migrates old and intermediate config keys to the current schema:
 * - features.enforcePackageManager -> features.nodePackageManager
 * - features.packageManager        -> features.nodePackageManager
 * - features.rewritePython         -> features.pythonToUv
 * - features.python                -> features.pythonToUv
 * - features.gitRebaseEditor       -> features.nonInteractiveGitRebase
 * - FeatureMode "rewrite"          -> "mutate"
 * - legacy booleans                -> FeatureMode values
 * - ui.showRewriteNotifications     -> ui.showMutationNotifications
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

  next.version = CURRENT_VERSION;

  return next;
}

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

  return next as ToolchainConfig;
}
