/**
 * Sets up all blocking hooks (tool_call event handlers).
 *
 * Blockers run before the spawn hook. A blocked command never reaches
 * the rewriters. Only features with mode "block" register a blocker.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config";
import { setupPackageManagerBlocker } from "./package-manager";
import { setupPythonBlocker } from "./python";

export function setupBlockers(
  pi: ExtensionAPI,
  config: ResolvedToolchainConfig,
): void {
  if (config.features.enforcePackageManager === "block") {
    setupPackageManagerBlocker(pi, config);
  }
  if (config.features.rewritePython === "block") {
    setupPythonBlocker(pi);
  }
}
