/**
 * Migration 0.10.1: normalize the config version field to package semver.
 *
 * Before this migration, configs were stamped with an ad hoc date-stamped
 * version string like "0.8.1-20260619". pi-utils-settings now supports
 * semver `Migration.version` values, so we normalize any pre-semver or
 * missing version to the current package version "0.10.1".
 *
 * The migration only rewrites the `version` field; it never changes user
 * feature values because all schema migrations already ran under 0.9.0.
 */

import type { Migration } from "@aliou/pi-utils-settings";
import type { ToolchainConfig } from "../types";

const CURRENT_PACKAGE_VERSION = "0.10.1";

/**
 * Regex for the pre-semver ad hoc stamps used before pi-utils-settings
 * supported semver migration versions (e.g. "0.8.1-20260619" or
 * "0.7.0-20260614").
 */
const LEGACY_STAMP_PATTERN = /^\d+\.\d+\.\d+-\d{8}$/;

/** Returns true for legacy stamps or missing versions. */
export function hasLegacyVersionStamp(config: ToolchainConfig): boolean {
  const version = (config as Record<string, unknown>).version;

  if (version === undefined) return true;
  if (typeof version !== "string") return false;

  // Legacy ad hoc stamps are not valid semver core.
  if (LEGACY_STAMP_PATTERN.test(version)) return true;

  // Anything parseable as a plain semver core is already normalized.
  return !/^\d{1,15}(\.\d{1,15})?(\.\d{1,15})?$/.test(version);
}

/** Rewrites `version` to the current package semver. */
export function migrateVersionStamp(config: ToolchainConfig): ToolchainConfig {
  const next = structuredClone(config) as Record<string, unknown>;
  next.version = CURRENT_PACKAGE_VERSION;
  return next as ToolchainConfig;
}

/** Terminal version normalization migration shipped in pi-toolchain@0.10.1. */
export const normalizeVersionStampMigration: Migration<ToolchainConfig> = {
  name: "normalize-version-stamp",
  version: CURRENT_PACKAGE_VERSION,
  shouldRun: (config) =>
    !config.version ||
    typeof config.version !== "string" ||
    hasLegacyVersionStamp(config),
  run: (config) => migrateVersionStamp(config),
};
