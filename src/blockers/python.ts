/**
 * Python command blocker.
 *
 * Used when rewritePython is set to "block" instead of "rewrite".
 * Blocks python/pip/poetry/pyenv/virtualenv commands and tells the model
 * to use uv instead.
 *
 * Uses AST-based matching. Falls back to regex on parse failure.
 */

import { parse } from "@aliou/sh";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { walkCommands, wordToString } from "../utils/shell-utils";

const BLOCKED_COMMANDS = new Set([
  "python",
  "python3",
  "pip",
  "pip3",
  "poetry",
  "pyenv",
  "virtualenv",
]);

const FALLBACK_PATTERN =
  /\b(python|python3|pip|pip3|poetry|pyenv|virtualenv)\b/;

export function setupPythonBlocker(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");

    let detected: string | null = null;
    try {
      const { ast } = parse(command);
      walkCommands(ast, (cmd) => {
        const name = cmd.words?.[0] ? wordToString(cmd.words[0]) : undefined;
        if (name && BLOCKED_COMMANDS.has(name)) {
          detected = name;
          return true;
        }
        return false;
      });
    } catch {
      const match = FALLBACK_PATTERN.exec(command);
      if (match?.[1]) detected = match[1];
    }

    if (!detected) return;

    ctx.ui.notify(`Blocked ${detected} command. Use uv instead.`, "warning");

    const reason =
      "Use uv for Python package management instead. " +
      "Run `uv init` to create a new Python project, " +
      "`uv run python` to run Python scripts, " +
      "or `uv add` to install packages (replaces pip/poetry).";

    return { block: true, reason };
  });
}
