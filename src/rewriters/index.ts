/**
 * Composes individual rewriters into a single BashSpawnHook.
 *
 * Each rewriter transforms a BashSpawnContext (command + cwd + env)
 * and returns a new context. They are chained sequentially.
 */

import type { BashSpawnContext } from "@mariozechner/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config-schema";
import { createGitRebaseRewriter } from "./git-rebase";
import { createPackageManagerRewriter } from "./package-manager";
import { createPythonRewriter } from "./python";

export function createSpawnHook(
  config: ResolvedToolchainConfig,
): (ctx: BashSpawnContext) => BashSpawnContext {
  const rewriters: ((ctx: BashSpawnContext) => BashSpawnContext)[] = [];

  if (config.features.enforcePackageManager) {
    rewriters.push(createPackageManagerRewriter(config));
  }
  if (config.features.rewritePython) {
    rewriters.push(createPythonRewriter());
  }
  if (config.features.gitRebaseEditor) {
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
