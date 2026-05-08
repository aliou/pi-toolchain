/**
 * Composes individual rewriters into a single BashSpawnHook and exposes
 * rewrite analysis for optional UI notifications.
 */

import type { BashSpawnContext } from "@earendil-works/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config";
import { createGitRebaseRewriter } from "./git-rebase";
import { createPackageManagerRewriter } from "./package-manager";
import { createPythonRewriter } from "./python";
import type { RewriteNotice, Rewriter } from "./types";

function createRewriters(config: ResolvedToolchainConfig): Rewriter[] {
  const rewriters: Rewriter[] = [];

  if (config.features.enforcePackageManager === "rewrite") {
    rewriters.push(createPackageManagerRewriter(config));
  }
  if (config.features.rewritePython === "rewrite") {
    rewriters.push(createPythonRewriter());
  }
  if (config.features.gitRebaseEditor === "rewrite") {
    rewriters.push(createGitRebaseRewriter());
  }

  return rewriters;
}

export function analyzeRewrite(
  ctx: BashSpawnContext,
  config: ResolvedToolchainConfig,
): { ctx: BashSpawnContext; notices: RewriteNotice[] } {
  let result = ctx;
  const notices: RewriteNotice[] = [];

  for (const rewrite of createRewriters(config)) {
    const rewriteResult = rewrite(result);
    result = rewriteResult.ctx;
    notices.push(...rewriteResult.notices);
  }

  return { ctx: result, notices };
}

export function createSpawnHook(
  config: ResolvedToolchainConfig,
): (ctx: BashSpawnContext) => BashSpawnContext {
  return (ctx) => analyzeRewrite(ctx, config).ctx;
}
