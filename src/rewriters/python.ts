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
import type { BashSpawnContext } from "@mariozechner/pi-coding-agent";
import { walkCommands, wordToString } from "../shell-utils";

const PYTHON_COMMANDS = new Set(["python", "python3"]);
const PIP_COMMANDS = new Set(["pip", "pip3"]);

interface Replacement {
  start: number;
  end: number;
  text: string;
}

export function createPythonRewriter(): (
  ctx: BashSpawnContext,
) => BashSpawnContext {
  return (ctx) => {
    let ast: Program;
    try {
      ({ ast } = parse(ctx.command));
    } catch {
      return ctx;
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
      if (!firstPart || firstPart.type !== "Literal") return;

      const literalValue = firstPart.value;
      const searchFrom =
        replacements.length > 0
          ? (replacements[replacements.length - 1] as Replacement).end
          : 0;

      const idx = findCommandPosition(ctx.command, literalValue, searchFrom);
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

    if (replacements.length === 0) return ctx;

    // Apply replacements from right to left so offsets remain valid.
    let result = ctx.command;
    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i] as Replacement;
      result = result.slice(0, r.start) + r.text + result.slice(r.end);
    }

    return { ...ctx, command: result };
  };
}

/**
 * Find the position of a command name in the source string, starting
 * from `searchFrom`. Matches on word boundary.
 */
function findCommandPosition(
  source: string,
  name: string,
  searchFrom: number,
): number {
  let pos = searchFrom;
  while (pos < source.length) {
    const idx = source.indexOf(name, pos);
    if (idx === -1) return -1;

    const before = idx > 0 ? source[idx - 1] : undefined;
    const after =
      idx + name.length < source.length ? source[idx + name.length] : undefined;

    const validBefore =
      before === undefined || /[\s;|&(]/.test(before) || before === "\n";
    const validAfter =
      after === undefined || /[\s;|&)]/.test(after) || after === "\n";

    if (validBefore && validAfter) return idx;

    pos = idx + 1;
  }
  return -1;
}
