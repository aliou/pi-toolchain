import {
  createBashTool,
  type ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { setupBlockers } from "./blockers";
import { registerToolchainSettings } from "./commands/settings-command";
import { configLoader } from "./config";
import { analyzeRewrite, createSpawnHook } from "./rewriters";
import { pendingWarnings } from "./utils/migration";

/**
 * Toolchain Extension
 *
 * Enforces opinionated toolchain preferences per feature, each independently
 * set to one of three modes:
 *
 * - "disabled": no action taken
 * - "rewrite": transparently rewrite commands via BashSpawnHook (overrides bash tool)
 * - "block": block commands via tool_call hook (bash tool is NOT overridden)
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

  // Flush any migration warnings at session start.
  pi.on("session_start", (_event, ctx) => {
    for (const warning of pendingWarnings.splice(0)) {
      ctx.ui.notify(warning, "warning");
    }
  });

  // Register blockers for features set to "block" mode.
  // These run via tool_call hooks and do not require overriding the bash tool.
  setupBlockers(pi, config);

  if (config.ui.showRewriteNotifications) {
    pi.on("tool_call", async (event, ctx) => {
      if (event.toolName !== "bash") return;

      const command = String(event.input.command ?? "");
      if (!command) return;

      const rewriteResult = analyzeRewrite(
        {
          command,
          cwd: process.cwd(),
          env: process.env,
        },
        config,
      );

      for (const notice of rewriteResult.notices) {
        ctx.ui.notify(notice.message, "warning");
      }

      return undefined;
    });
  }

  // Register bash tool with spawn hook only if at least one feature uses "rewrite" mode.
  // When all features are "disabled" or "block", the bash tool is left as-is.
  const hasRewriters =
    config.features.enforcePackageManager === "rewrite" ||
    config.features.rewritePython === "rewrite" ||
    config.features.gitRebaseEditor === "rewrite";

  if (hasRewriters) {
    const spawnHook = createSpawnHook(config);
    const bashTool = createBashTool(process.cwd(), { spawnHook });
    pi.registerTool({ ...bashTool });
  }
}
