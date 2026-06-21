/**
 * Composes individual rewriters into a single analysis function.
 *
 * Pure: no Pi API imports. Takes a command string (+ optional env) and
 * returns a rewritten command string plus notices.
 */

import type { ResolvedToolchainConfig } from "../config";
import { createNixShellRewriter } from "./nix-shell";
import { createNodePackageManagerRewriter } from "./node-package-manager";
import { createNonInteractiveGitRebaseRewriter } from "./non-interactive-git-rebase";
import { createPythonToUvRewriter } from "./python-to-uv";
import type {
  RewriteInput,
  RewriteNotice,
  RewriteResult,
  Rewriter,
} from "./types";

function createRewriters(config: ResolvedToolchainConfig): Rewriter[] {
  const rewriters: Rewriter[] = [];

  if (config.features.nodePackageManager === "mutate") {
    rewriters.push(createNodePackageManagerRewriter(config));
  }
  if (config.features.pythonToUv === "mutate") {
    rewriters.push(createPythonToUvRewriter());
  }
  if (config.features.nonInteractiveGitRebase === "mutate") {
    rewriters.push(createNonInteractiveGitRebaseRewriter());
  }
  if (config.features.nixShell === "mutate") {
    rewriters.push(createNixShellRewriter());
  }

  return rewriters;
}

export function analyzeRewrite(
  input: RewriteInput,
  config: ResolvedToolchainConfig,
): RewriteResult {
  let command = input.command;
  const notices: RewriteNotice[] = [];

  for (const rewrite of createRewriters(config)) {
    const result = rewrite({ ...input, command });
    command = result.command;
    notices.push(...result.notices);
  }

  return { command, notices };
}
