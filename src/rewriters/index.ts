/**
 * Composes individual rewriters into a single BashSpawnHook.
 *
 * Each rewriter transforms a BashSpawnContext (command + cwd + env)
 * and returns a new context. They are chained sequentially.
 * Only features with mode "rewrite" are included.
 */

import type { BashSpawnContext } from "@mariozechner/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config";
import { createGitRebaseRewriter } from "./git-rebase";
import { createPackageManagerRewriter } from "./package-manager";
import { createPythonRewriter } from "./python";

export function createSpawnHook(
  config: ResolvedToolchainConfig,
): (ctx: BashSpawnContext) => BashSpawnContext {
  const rewriters: ((ctx: BashSpawnContext) => BashSpawnContext)[] = [];

  if (config.features.enforcePackageManager === "rewrite") {
    rewriters.push(createPackageManagerRewriter(config));
  }
  if (config.features.rewritePython === "rewrite") {
    rewriters.push(createPythonRewriter());
  }
  if (config.features.gitRebaseEditor === "rewrite") {
    rewriters.push(createGitRebaseRewriter());
  }

  return (ctx) => {
    let result = ctx;
    for (const rewrite of rewriters) {
      result = rewrite(result);
    }
    return result;
  };
}
