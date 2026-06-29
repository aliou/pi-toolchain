/**
 * Python command rewriter.
 *
 * Rewrites bare `python` command invocations to `python3` while leaving
 * `python3`, strings, paths, and heredoc bodies unchanged.
 */

import type { Program } from "@aliou/sh";
import { parse } from "@aliou/sh";
import { walkCommands } from "../shell/ast";
import { findCommandPosition } from "../shell/command-position";
import { wordToString } from "../shell/word-to-string";
import type { Rewriter } from "./types";

interface Replacement {
  start: number;
  end: number;
  text: string;
}

export function detectBarePythonCommand(command: string): string | null {
  let detected: string | null = null;

  try {
    const { ast } = parse(command);
    walkCommands(ast, (cmd) => {
      const name = cmd.words?.[0] ? wordToString(cmd.words[0]) : undefined;
      if (name === "python") {
        detected = name;
        return true;
      }
      return false;
    });
  } catch {
    // No regex fallback. False-positive blocking/rewrite is worse than a miss.
  }

  return detected;
}

export function createPythonToPython3Rewriter(): Rewriter {
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
      if (name !== "python") return;

      const firstPart = firstWord.parts[0];
      if (firstPart?.type !== "Literal") return;

      const literalValue = firstPart.value;
      const searchFrom =
        replacements.length > 0
          ? (replacements[replacements.length - 1] as Replacement).end
          : 0;

      const idx = findCommandPosition(command, literalValue, searchFrom);
      if (idx === -1) return;

      replacements.push({
        start: idx,
        end: idx + literalValue.length,
        text: "python3",
      });

      return undefined;
    });

    if (replacements.length === 0) return { command, notices: [] };

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
