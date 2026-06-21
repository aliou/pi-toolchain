/**
 * Config migrations for the toolchain extension.
 *
 * Uses a version field to gate migrations, following the same pattern as
 * pi-guardrails. Configs without a version field are considered v0 (legacy).
 *
 * Each migration lives in its own file and exports a single
 * `Migration<ToolchainConfig>` object. This file simply aggregates them
 * into the ordered `migrations` array and re-exports the helpers (kept
 * exported so tests and callers can exercise them directly).
 *
 * All migration functions are pure: they take a config and return a
 * migrated config with no side effects. User-facing messages are declared
 * on each migration object via the `message` field, and are emitted by
 * ConfigLoader.drainMessages(). The message strings do NOT carry a
 * "[toolchain]" prefix — the extension's session_start handler adds it
 * when building the single notification.
 *
 * Migrations run in sequence:
 *  1. v0-to-current          — boolean features -> FeatureMode, strip moved features
 *  2. rename-keys-and-mutate — collapse legacy/intermediate keys + "rewrite" -> "mutate"
 *  3. remove-bash-config      — strip the removed bash config surface
 *
 * v0-to-current produces old key names with "mutate" mode;
 * rename-keys-and-mutate-mode then fixes the keys. All stamp CURRENT_VERSION
 * — this is intentional since each migration gates on its own shouldRun
 * condition and is idempotent.
 */

import type { Migration } from "@aliou/pi-utils-settings";
import type { ToolchainConfig } from "../types";
import { v0ToCurrentMigration } from "./01-v0-to-current";
import { renameKeysMigration } from "./02-rename-keys";
import { removeBashConfigMigration } from "./03-remove-bash-config";

export {
  isV0,
  migrateV0,
  v0Message,
  v0ToCurrentMigration,
} from "./01-v0-to-current";
export {
  migrateRenameKeys,
  needsKeyRename,
  renameKeysMigration,
} from "./02-rename-keys";
export {
  hasStaleBashConfig,
  migrateRemoveBashConfig,
  removeBashConfigMigration,
} from "./03-remove-bash-config";
export { CURRENT_VERSION } from "./version";

/** Ordered list of config migrations applied by ConfigLoader during load. */
export const migrations: Migration<ToolchainConfig>[] = [
  v0ToCurrentMigration,
  renameKeysMigration,
  removeBashConfigMigration,
];
