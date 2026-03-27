import {
  createBashTool,
  type ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { setupBlockers } from "./blockers";
import { registerToolchainSettings } from "./commands/settings-command";
import { configLoader } from "./config";
import {
  hasRewriteFeatures,
  registerRewriteNotifications,
} from "./hooks/rewrite-notifications";
import { registerSessionStartWarnings } from "./hooks/session-start";
import { createSpawnHook } from "./rewriters";

/**
 * Toolchain Extension
 *
 * Enforces opinionated toolchain preferences per feature, each independently
 * set to one of three modes:
 *
 * - "disabled": no action taken
 * - "rewrite": transparently rewrite commands via spawn hook
 * - "block": block commands via tool_call hook
 *
 * Configuration:
 * - Global: ~/.pi/agent/extensions/toolchain.json
 * - Project: .pi/extensions/toolchain.json
 */
export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  const config = configLoader.getConfig();
  if (!config.enabled) return;

  registerToolchainSettings(pi);
  registerSessionStartWarnings(pi);
  setupBlockers(pi, config);
  registerRewriteNotifications(pi, config);

  if (!hasRewriteFeatures(config)) return;

  const spawnHook = createSpawnHook(config);
  const bashTool = createBashTool(process.cwd(), { spawnHook });
  pi.registerTool({ ...bashTool });
}
