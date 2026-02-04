import {
  createBashTool,
  type ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { setupBlockers } from "./blockers";
import { registerToolchainSettings } from "./commands/settings-command";
import { configLoader } from "./config";
import { createSpawnHook } from "./rewriters";

/**
 * Toolchain Extension
 *
 * Enforces opinionated toolchain preferences by transparently rewriting
 * commands where possible (via BashSpawnHook) or blocking when no rewrite
 * target exists (via tool_call event hooks).
 *
 * Configuration:
 * - Global: ~/.pi/agent/extensions/toolchain.json
 * - Project: .pi/extensions/toolchain.json
 */
export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  const config = configLoader.getConfig();
  if (!config.enabled) return;

  // Register settings command.
  registerToolchainSettings(pi);

  // Register blockers first (tool_call event hooks).
  // These run before the spawn hook and can block commands entirely.
  setupBlockers(pi, config);

  // Register bash tool with spawn hook (command rewriting).
  // Only if at least one rewriter feature is enabled.
  const hasRewriters =
    config.features.enforcePackageManager ||
    config.features.rewritePython ||
    config.features.gitRebaseEditor;

  if (hasRewriters) {
    const spawnHook = createSpawnHook(config);
    const bashTool = createBashTool(process.cwd(), { spawnHook });
    pi.registerTool({ ...bashTool });
  }
}
