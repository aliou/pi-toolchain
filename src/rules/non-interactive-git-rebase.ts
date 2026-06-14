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
 *
 * In the pure layer, env injection is done by prefixing the command:
 *   git rebase -i HEAD~1
 *   -> GIT_EDITOR=true GIT_SEQUENCE_EDITOR=: git rebase -i HEAD~1
 */

import { parse } from "@aliou/sh";
import { walkCommandsWithAssignments } from "../shell/ast";
import { wordToString } from "../shell/word-to-string";
import type { Rewriter } from "./types";

export function createNonInteractiveGitRebaseRewriter(): Rewriter {
  return (input) => {
    const { command } = input;
    let needsEditor = false;

    try {
      const { ast } = parse(command);

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
      if (/\bgit\s+rebase\b/.test(command)) {
        // Skip if already has editor config
        if (!/GIT_SEQUENCE_EDITOR|GIT_EDITOR|core\.editor/.test(command)) {
          needsEditor = true;
        }
      }
    }

    if (!needsEditor) return { command, notices: [] };

    // Skip if env vars already set in the context
    if (input.env?.GIT_EDITOR || input.env?.GIT_SEQUENCE_EDITOR) {
      return { command, notices: [] };
    }

    // Use `export` so env vars apply to ALL commands in a compound expression
    // (e.g. `git fetch && git rebase`). Plain `KEY=val cmd` only applies to
    // the first command, which is wrong when `git rebase` is not the first token.
    return {
      command: `export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=:; ${command}`,
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
