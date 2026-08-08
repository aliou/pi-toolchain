/**
 * Config migrations for the toolchain extension.
 *
 * Uses the extension's package semver as the config `version` value,
 * following pi-utils-settings versioned migration conventions.
 *
 * Each migration lives in its own file and exports a single
 * `Migration<ToolchainConfig>` object. This file aggregates them into the
 * ordered `migrations` array and re-exports the helper functions (kept
 * exported so tests and callers can exercise them directly).
 *
 * Migrations run in order:
 *  1. v0-9-0 — compose the legacy v0, key-rename, and bash-removal
 *              migrations that all shipped in pi-toolchain@0.9.0.
 *  2. normalize-version-stamp — convert legacy date-stamped version strings
 *                               like "0.8.1-20260619" into package semver.
 */

import type { Migration } from "@aliou/pi-utils-settings";
import type { ToolchainConfig } from "../types";
import { v090Migration } from "./01-v0-9-0";
import { normalizeVersionStampMigration } from "./02-normalize-version-stamp";

export * from "./01-v0-9-0";
export * from "./02-normalize-version-stamp";

/** Ordered list of config migrations applied by ConfigLoader during load. */
export const migrations: Migration<ToolchainConfig>[] = [
  v090Migration,
  normalizeVersionStampMigration,
];
