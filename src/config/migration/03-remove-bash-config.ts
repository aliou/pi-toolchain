/**
 * Migration 3: remove-bash-config.
 *
 * Bash integration was removed; tool_call is now the only runtime hook.
 * This migration strips stale bash.sourceMode from user configs.
 *
 * Pure: takes a config, returns a migrated config with no side effects.
 * Stamps CURRENT_VERSION — intentional since each migration gates on its
 * own shouldRun condition and is idempotent.
 */

import type { Migration } from "@aliou/pi-utils-settings";
import type { ToolchainConfig } from "../types";
import { CURRENT_VERSION } from "./version";

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

/** remove-bash-config migration: strips the removed bash config surface. */
export const removeBashConfigMigration: Migration<ToolchainConfig> = {
  name: "remove-bash-config",
  shouldRun: (config) => hasStaleBashConfig(config),
  run: (config) => migrateRemoveBashConfig(config),
  message:
    "Removed stale bash.sourceMode config — " +
    "bash integration has been removed. " +
    "Use /toolchain:settings to configure.",
};
