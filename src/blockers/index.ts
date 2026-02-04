/**
 * Sets up all blocking hooks (tool_call event handlers).
 *
 * Blockers run before the spawn hook. A blocked command never reaches
 * the rewriters.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config";
import { setupBrewBlocker } from "./brew";
import { setupPythonConfirm } from "./python-confirm";

export function setupBlockers(
  pi: ExtensionAPI,
  config: ResolvedToolchainConfig,
): void {
  if (config.features.preventBrew) {
    setupBrewBlocker(pi);
  }
  if (config.features.rewritePython) {
    setupPythonConfirm(pi);
  }
}
