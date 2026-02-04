/**
 * Blocks all brew commands. Homebrew is not available -- use Nix instead.
 *
 * Uses AST-based matching to avoid false positives where "brew" appears
 * in commit messages, grep patterns, or file paths. Falls back to regex
 * on parse failure (blocking false positives are annoying but safe,
 * unlike rewriting false positives which corrupt commands).
 */

import { parse } from "@aliou/sh";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { walkCommands, wordToString } from "../utils/shell-utils";

const BREW_PATTERN = /\bbrew\b/;

export function setupBrewBlocker(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");

    let hasBrew = false;
    try {
      const { ast } = parse(command);
      walkCommands(ast, (cmd) => {
        const name = cmd.words?.[0] ? wordToString(cmd.words[0]) : undefined;
        if (name === "brew") {
          hasBrew = true;
          return true;
        }
        return false;
      });
    } catch {
      hasBrew = BREW_PATTERN.test(command);
    }

    if (hasBrew) {
      ctx.ui.notify(
        "Blocked brew command. Homebrew is not installed.",
        "warning",
      );

      const reason =
        "Homebrew is not installed on this machine. " +
        "Use Nix for package management instead. " +
        "Run packages via nix-shell or add them to the project's Nix configuration.";

      return { block: true, reason };
    }

    return;
  });
}
