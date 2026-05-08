import type { BashSpawnContext } from "@earendil-works/pi-coding-agent";

export interface RewriteNotice {
  message: string;
}

export interface RewriteResult {
  ctx: BashSpawnContext;
  notices: RewriteNotice[];
}

export type Rewriter = (ctx: BashSpawnContext) => RewriteResult;
