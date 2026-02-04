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
import type { BashSpawnContext } from "@mariozechner/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config-schema";
import { walkCommands, wordToString } from "../shell-utils";

type PackageManager = "bun" | "pnpm" | "npm";

const ALL_MANAGERS = new Set<string>(["bun", "pnpm", "npm", "npx", "yarn"]);

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

export function createPackageManagerRewriter(
  config: ResolvedToolchainConfig,
): (ctx: BashSpawnContext) => BashSpawnContext {
  const selected = config.packageManager.selected;

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
      if (!ALL_MANAGERS.has(name) || name === selected) return;

      // Get the literal part for position info. Only rewrite if the
      // first part is a simple Literal (no expansions in command name).
      const firstPart = firstWord.parts[0];
      if (!firstPart || firstPart.type !== "Literal") return;

      const literalValue = firstPart.value;
      // The word's position in the source is derived from the literal value.
      // @aliou/sh doesn't expose source positions, so we find the command
      // name in the source string. We search from after the last replacement
      // to handle multiple commands.
      const searchFrom =
        replacements.length > 0
          ? (replacements[replacements.length - 1] as Replacement).end
          : 0;

      const idx = findCommandPosition(ctx.command, literalValue, searchFrom);
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
 * from `searchFrom`. Matches on word boundary to avoid matching inside
 * paths or URLs.
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

    // Check word boundaries: char before must be start-of-string or
    // a shell delimiter, char after must be end-of-string or delimiter.
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
