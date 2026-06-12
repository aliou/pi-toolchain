/**
 * Composes individual rewriters into a single analysis function.
 *
 * Pure: no Pi API imports. Takes a command string (+ optional env) and
 * returns a rewritten command string plus notices.
 */

import type { ResolvedToolchainConfig } from "../config";
import { createGitRebaseRewriter } from "./git-rebase";
import { createPackageManagerRewriter } from "./package-manager";
import { createPythonRewriter } from "./python";
import type {
  RewriteInput,
  RewriteNotice,
  RewriteResult,
  Rewriter,
} from "./types";

function createRewriters(config: ResolvedToolchainConfig): Rewriter[] {
  const rewriters: Rewriter[] = [];

  if (config.features.packageManager === "mutate") {
    rewriters.push(createPackageManagerRewriter(config));
  }
  if (config.features.python === "mutate") {
    rewriters.push(createPythonRewriter());
  }
  if (config.features.gitRebaseEditor === "mutate") {
    rewriters.push(createGitRebaseRewriter());
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
