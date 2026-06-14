/**
 * Package manager rewriter.
 *
 * Rewrites commands that use a non-selected package manager to use the
 * selected one. Uses AST parsing for surgical string replacement at exact
 * character positions to avoid corrupting arguments or strings.
 *
 * If AST parse fails, returns the command unchanged (no regex fallback
 * for rewrites -- a false positive rewrite is worse than a missed one).
 */

import type { Program } from "@aliou/sh";
import { parse } from "@aliou/sh";
import type { ResolvedToolchainConfig } from "../config/types";
import { walkCommands } from "../shell/ast";
import { findCommandPosition } from "../shell/command-position";
import { wordToString } from "../shell/word-to-string";
import type { Rewriter } from "./types";

type PackageManager = "bun" | "pnpm" | "npm";

const ALL_MANAGERS = new Set<string>(["bun", "pnpm", "npm", "npx", "yarn"]);

/** Detect a non-selected package manager command. Returns the detected name or null. */
export function detectForeignPackageManager(
  command: string,
  selected: PackageManager,
): string | null {
  let detected: string | null = null;

  try {
    const { ast } = parse(command);
    walkCommands(ast, (cmd) => {
      const name = cmd.words?.[0] ? wordToString(cmd.words[0]) : undefined;
      if (name && ALL_MANAGERS.has(name) && name !== selected) {
        detected = name;
        return true;
      }
      return false;
    });
  } catch {
    for (const mgr of ALL_MANAGERS) {
      if (mgr !== selected && new RegExp(`\\b${mgr}\\b`).test(command)) {
        detected = mgr;
        break;
      }
    }
  }

  return detected;
}

/** Maps npx-like commands to the selected manager's equivalent. */
const NPX_EQUIVALENT: Record<PackageManager, string> = {
  pnpm: "pnpm dlx",
  bun: "bunx",
  npm: "npx",
};

interface Replacement {
  /** Start character offset in the original command string. */
  start: number;
  /** End character offset (exclusive) in the original command string. */
  end: number;
  /** The replacement text. */
  text: string;
}

export function createNodePackageManagerRewriter(
  config: ResolvedToolchainConfig,
): Rewriter {
  const selected = config.nodePackageManager.selected;

  return (input) => {
    const { command } = input;

    let ast: Program;
    try {
      ({ ast } = parse(command));
    } catch {
      return { command, notices: [] };
    }

    const replacements: Replacement[] = [];

    walkCommands(ast, (cmd) => {
      const firstWord = cmd.words?.[0];
      if (!firstWord) return;

      const name = wordToString(firstWord);
      if (!ALL_MANAGERS.has(name) || name === selected) return;

      // Get the literal part for position info. Only rewrite if the
      // first part is a simple Literal (no expansions in command name).
      const firstPart = firstWord.parts[0];
      if (firstPart?.type !== "Literal") return;

      const literalValue = firstPart.value;
      // The word's position in the source is derived from the literal value.
      // @aliou/sh doesn't expose source positions, so we find the command
      // name in the source string. We search from after the last replacement
      // to handle multiple commands.
      const searchFrom =
        replacements.length > 0
          ? (replacements[replacements.length - 1] as Replacement).end
          : 0;

      const idx = findCommandPosition(command, literalValue, searchFrom);
      if (idx === -1) return;

      if (name === "npx") {
        replacements.push({
          start: idx,
          end: idx + literalValue.length,
          text: NPX_EQUIVALENT[selected],
        });
      } else if (name === "yarn") {
        replacements.push({
          start: idx,
          end: idx + literalValue.length,
          text: selected,
        });
      } else if (name !== selected) {
        // npm, pnpm, or bun -> selected
        replacements.push({
          start: idx,
          end: idx + literalValue.length,
          text: selected,
        });
      }

      return undefined;
    });

    if (replacements.length === 0) return { command, notices: [] };

    // Apply replacements from right to left so offsets remain valid.
    let result = command;
    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i] as Replacement;
      result = result.slice(0, r.start) + r.text + result.slice(r.end);
    }

    return {
      command: result,
      notices:
        result === command
          ? []
          : [{ message: `Rewrote command: ${command} -> ${result}` }],
    };
  };
}
