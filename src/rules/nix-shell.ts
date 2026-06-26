/**
 * Nix shell / devShell rewriter.
 *
 * When shell.nix or flake.nix (with a devShell) is detected in the
 * command working directory, wraps bash commands to run inside the
 * nix environment.
 *
 * - shell.nix  -> nix-shell --run 'command'
 * - flake.nix  -> nix develop --command sh -c 'command'
 *
 * Skips rewriting when:
 * - Already inside a nix shell (IN_NIX_SHELL env var is set)
 * - The command itself is a nix command (nix-shell, nix develop, etc.)
 * - No shell.nix or flake.nix with devShell is found in the command cwd.
 *
 * If AST parse fails, falls back to checking the first raw word.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@aliou/sh";
import { walkCommands } from "../shell/ast";
import { wordToString } from "../shell/word-to-string";
import type { Rewriter } from "./types";

const NIX_COMMANDS = new Set(["nix-shell", "nix"]);
const DEVSHELL_PATTERN = /\bdevShells?\b/;

/** Check whether the first command word is a nix command. */
function isNixCommandName(name: string): boolean {
  return NIX_COMMANDS.has(name);
}

/** Detect the type of nix shell available in `cwd`. */
export function detectNixShell(cwd: string): "shell" | "flake" | null {
  const flakePath = join(cwd, "flake.nix");
  if (existsSync(flakePath)) {
    try {
      const content = readFileSync(flakePath, "utf-8");
      if (DEVSHELL_PATTERN.test(content)) {
        return "flake";
      }
    } catch {
      // unreadable flake.nix — treat as no devshell
    }
  }

  if (existsSync(join(cwd, "shell.nix"))) {
    return "shell";
  }

  return null;
}

/** Escape a command for safe use inside single-quoted shell arguments. */
function escapeForSingleQuotes(command: string): string {
  return command.replace(/'/g, "'\"'\"'");
}

export function createNixShellRewriter(): Rewriter {
  return (input) => {
    const { command, cwd, env } = input;

    // Skip if already inside a nix shell (e.g. direnv or manual nix-shell)
    if (env?.IN_NIX_SHELL) {
      return { command, notices: [] };
    }

    const nixType = detectNixShell(cwd ?? process.cwd());
    if (!nixType) {
      return { command, notices: [] };
    }

    // Detect if the command itself is a nix command — skip rewriting
    let isNix = false;
    try {
      const { ast } = parse(command);
      walkCommands(ast, (cmd) => {
        const name = cmd.words?.[0] ? wordToString(cmd.words[0]) : undefined;
        if (name && isNixCommandName(name)) {
          isNix = true;
          return true;
        }
        return false;
      });
    } catch {
      // Fallback: first whitespace-separated word
      const firstWord = command.trim().split(/\s+/)[0];
      if (firstWord && isNixCommandName(firstWord)) {
        isNix = true;
      }
    }

    if (isNix) {
      return { command, notices: [] };
    }

    const escaped = escapeForSingleQuotes(command);

    if (nixType === "shell") {
      const result = `nix-shell --run '${escaped}'`;
      return {
        command: result,
        notices: [{ message: `Rewrote command: ${command} -> ${result}` }],
      };
    }

    // flake with devShell
    const result = `nix develop --command sh -c '${escaped}'`;
    return {
      command: result,
      notices: [{ message: `Rewrote command: ${command} -> ${result}` }],
    };
  };
}
