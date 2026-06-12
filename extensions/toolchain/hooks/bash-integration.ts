import {
  type BashSpawnContext,
  createBashTool,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../../../src/config";
import { analyzeRewrite } from "../../../src/rules";
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

function createSpawnHook(config: ResolvedToolchainConfig) {
  return (ctx: BashSpawnContext): BashSpawnContext => {
    const result = analyzeRewrite(
      {
        command: ctx.command,
        env: ctx.env,
      },
      config,
    );

    if (result.command === ctx.command) return ctx;

    return {
      ...ctx,
      command: result.command,
    };
  };
}
