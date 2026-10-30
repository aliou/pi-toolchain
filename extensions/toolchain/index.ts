import { bindProjectConfig } from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { configLoader } from "../../src/config";
import { registerToolCallHandler } from "./hooks/tool-call";
import { registerToolchainSettings } from "./settings";

/**
 * Toolchain Extension
 *
 * Enforces opinionated toolchain preferences per feature, each independently
 * set to one of three modes:
 *
 * - "disabled": no action taken
 * - "mutate": transparently mutate commands before shell execution
 * - "block": block commands via tool_call hook
 *
 * All runtime behavior is handled through a single tool_call hook:
 * - Blockers reject matching commands with a reason
 * - Mutators rewrite event.input.command in place
 * - Notifications inform the user of mutations
 *
 * Configuration:
 * - Global: ~/.pi/agent/extensions/toolchain.json
 * - Project: .pi/extensions/toolchain.json
 */
export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  bindProjectConfig(pi, configLoader);

  registerToolchainSettings(pi);

  pi.on("session_start", (_event, ctx) => {
    const messages = configLoader.drainMessages();
    if (messages.length === 0) return;

    const body = messages.map((m) => `- ${m}`).join("\n");
    ctx.ui.notify(`[toolchain] Config notices:\n${body}`, "warning");
  });

  registerToolCallHandler(pi, () => configLoader.getConfig());
}
