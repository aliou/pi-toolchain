/**
 * Python/pip rewriter.
 *
 * Rewrites python/pip commands to uv equivalents:
 *   python script.py  -> uv run python script.py
 *   python3 script.py -> uv run python3 script.py
 *   pip install X     -> uv pip install X
 *   pip3 install X    -> uv pip install X
 *
 * Does NOT rewrite poetry, pyenv, virtualenv -- those are blocked by
 * the python-confirm blocker, not rewritten.
 *
 * If AST parse fails, returns the command unchanged (no regex fallback
 * for rewrites).
 */

import type { Program } from "@aliou/sh";
import { parse } from "@aliou/sh";
import { walkCommands } from "../shell/ast";
import { findCommandPosition } from "../shell/command-position";
import { wordToString } from "../shell/word-to-string";
import type { Rewriter } from "./types";

const PYTHON_COMMANDS = new Set(["python", "python3"]);
const PIP_COMMANDS = new Set(["pip", "pip3"]);

const BLOCKED_PYTHON_COMMANDS = new Set([
  "python",
  "python3",
  "pip",
  "pip3",
  "poetry",
  "pyenv",
  "virtualenv",
]);

const PYTHON_FALLBACK_PATTERN =
  /\b(python|python3|pip|pip3|poetry|pyenv|virtualenv)\b/;

/** Detect a python-related command. Returns the detected name or null. */
export function detectPythonCommand(command: string): string | null {
  let detected: string | null = null;

  try {
    const { ast } = parse(command);
    walkCommands(ast, (cmd) => {
      const name = cmd.words?.[0] ? wordToString(cmd.words[0]) : undefined;
      if (name && BLOCKED_PYTHON_COMMANDS.has(name)) {
        detected = name;
        return true;
      }
      return false;
    });
  } catch {
    const match = PYTHON_FALLBACK_PATTERN.exec(command);
    if (match?.[1]) detected = match[1];
  }

  return detected;
}

interface Replacement {
  start: number;
  end: number;
  text: string;
}

export function createPythonRewriter(): Rewriter {
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

      const isPython = PYTHON_COMMANDS.has(name);
      const isPip = PIP_COMMANDS.has(name);
      if (!isPython && !isPip) return;

      const firstPart = firstWord.parts[0];
      if (firstPart?.type !== "Literal") return;

      const literalValue = firstPart.value;
      const searchFrom =
        replacements.length > 0
          ? (replacements[replacements.length - 1] as Replacement).end
          : 0;

      const idx = findCommandPosition(command, literalValue, searchFrom);
      if (idx === -1) return;

      if (isPython) {
        // python X -> uv run python X (prepend "uv run ")
        replacements.push({
          start: idx,
          end: idx,
          text: "uv run ",
        });
      } else {
        // pip X -> uv pip X (replace pip/pip3 with "uv pip")
        replacements.push({
          start: idx,
          end: idx + literalValue.length,
          text: "uv pip",
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
