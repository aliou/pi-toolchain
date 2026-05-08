import {
  createBashTool,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config";
import { createSpawnHook } from "../rewriters";
import {
  BASH_SPAWN_HOOK_REQUEST_EVENT,
  isSpawnHookRequestPayload,
  TOOLCHAIN_SPAWN_HOOK_CONTRIBUTOR_ID,
  TOOLCHAIN_SPAWN_HOOK_PRIORITY,
} from "../utils/bash-composition";

export function registerBashIntegration(
  pi: ExtensionAPI,
  config: ResolvedToolchainConfig,
): void {
  const spawnHook = createSpawnHook(config);

  if (config.bash.sourceMode === "composed-bash") {
    pi.events.on(BASH_SPAWN_HOOK_REQUEST_EVENT, (data: unknown) => {
      if (!isSpawnHookRequestPayload(data)) return;

      data.register({
        id: TOOLCHAIN_SPAWN_HOOK_CONTRIBUTOR_ID,
        priority: TOOLCHAIN_SPAWN_HOOK_PRIORITY,
        spawnHook,
      });
    });
    return;
  }

  const bashTool = createBashTool(process.cwd(), { spawnHook });
  pi.registerTool({ ...bashTool });
}
