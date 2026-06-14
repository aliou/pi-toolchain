import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { configLoader } from "../../src/config";
import {
  hasToolCallFeatures,
  registerToolCallHandler,
} from "./hooks/tool-call";
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
  const config = configLoader.getConfig();
  if (!config.enabled) return;

  registerToolchainSettings(pi);

  pi.on("session_start", (_event, ctx) => {
    const messages = configLoader.drainMessages();
    if (messages.length === 0) return;

    // Send a single notification rather than one per message. The header and
    // "[toolchain]" prefix live here instead of in the migration message
    // strings, so individual messages stay self-contained. Always uses the
    // same bulleted layout, regardless of message count.
    const body = messages.map((m) => `- ${m}`).join("\n");
    ctx.ui.notify(`[toolchain] Your config was migrated:\n${body}`, "warning");
  });

  if (hasToolCallFeatures(config)) {
    registerToolCallHandler(pi, config);
  }
}
