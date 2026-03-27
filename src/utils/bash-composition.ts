import type { BashSpawnContext } from "@mariozechner/pi-coding-agent";

export const BASH_SPAWN_HOOK_REQUEST_EVENT = "ad:bash:spawn-hook:request";
export const TOOLCHAIN_SPAWN_HOOK_CONTRIBUTOR_ID = "toolchain";
export const TOOLCHAIN_SPAWN_HOOK_PRIORITY = 100;

export type SpawnHookContributor = {
  id: string;
  priority?: number;
  spawnHook: (ctx: BashSpawnContext) => BashSpawnContext;
};

export type SpawnHookRequestPayload = {
  register: (contributor: SpawnHookContributor) => void;
};

export function isSpawnHookRequestPayload(
  value: unknown,
): value is SpawnHookRequestPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<SpawnHookRequestPayload>;
  return typeof v.register === "function";
}
