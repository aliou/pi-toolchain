import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { configLoader } from "../../src/config";
import { registerBashIntegration } from "./hooks/bash-integration";
import { registerSessionStartWarnings } from "./hooks/session-start";
import {
  hasMutationFeatures,
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

  if (hasToolCallFeatures(config)) {
    registerToolCallHandler(pi, config);
  }

  if (!hasMutationFeatures(config)) return;
  registerBashIntegration(pi, config);
}
