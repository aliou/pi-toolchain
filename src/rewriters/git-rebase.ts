/**
 * Git rebase editor rewriter.
 *
 * Injects GIT_EDITOR and GIT_SEQUENCE_EDITOR env vars for git rebase
 * commands so they run non-interactively without opening an editor.
 *
 * - GIT_EDITOR=true: prevents commit message editor (rebase --continue)
 * - GIT_SEQUENCE_EDITOR=: accepts default rebase sequence (interactive rebase)
 *
 * Skips injection if the command already has editor configuration via
 * AST assignments or existing env vars.
 */

import { parse } from "@aliou/sh";
import {
  walkCommandsWithAssignments,
  wordToString,
} from "../utils/shell-utils";
import type { Rewriter } from "./types";

export function createGitRebaseRewriter(): Rewriter {
  return (ctx) => {
    let needsEditor = false;

    try {
      const { ast } = parse(ctx.command);

      walkCommandsWithAssignments(ast, (cmd, assignments) => {
        const words = (cmd.words ?? []).map(wordToString);
        if (words[0] !== "git" || words[1] !== "rebase") return;

        // Skip if already configured via inline assignments
        if (hasEditorAssignment(assignments)) return;

        needsEditor = true;
        return true;
      });
    } catch {
      // Fallback: check raw string for git rebase pattern
      if (/\bgit\s+rebase\b/.test(ctx.command)) {
        // Skip if already has editor config
        if (!/GIT_SEQUENCE_EDITOR|GIT_EDITOR|core\.editor/.test(ctx.command)) {
          needsEditor = true;
        }
      }
    }

    if (!needsEditor) return { ctx, notices: [] };

    // Skip if env vars already set in the context
    if (ctx.env.GIT_EDITOR || ctx.env.GIT_SEQUENCE_EDITOR) {
      return { ctx, notices: [] };
    }

    return {
      ctx: {
        ...ctx,
        env: {
          ...ctx.env,
          GIT_EDITOR: "true",
          GIT_SEQUENCE_EDITOR: ":",
        },
      },
      notices: [
        {
          message:
            "Rewrote command behavior: injected GIT_EDITOR=true and GIT_SEQUENCE_EDITOR=: for git rebase",
        },
      ],
    };
  };
}

function hasEditorAssignment(assignments: { name: string }[]): boolean {
  return assignments.some(
    (a) => a.name === "GIT_SEQUENCE_EDITOR" || a.name === "GIT_EDITOR",
  );
}
