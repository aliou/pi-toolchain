/**
 * Python command blocker/confirmer.
 *
 * Runs before the python rewriter. Handles two cases:
 *
 * 1. poetry/pyenv/virtualenv: Always blocked (no rewrite target).
 * 2. python/pip commands outside a uv project (no pyproject.toml):
 *    Shows a confirmation dialog. If confirmed, the command proceeds
 *    and the spawn hook rewriter handles the rewrite to uv.
 *
 * If a pyproject.toml exists in cwd, python/pip commands pass through
 * silently (the rewriter wraps them in uv).
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@aliou/sh";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { walkCommands, wordToString } from "../utils/shell-utils";

const PYTHON_COMMANDS = new Set(["python", "python3", "pip", "pip3"]);

const BLOCKED_COMMANDS = new Set(["poetry", "pyenv", "virtualenv"]);

const PYTHON_PATTERN = /\b(python|python3|pip|pip3|poetry|pyenv|virtualenv)\b/;

export function setupPythonConfirm(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");

    let detectedCommand: string | null = null;
    let isBlocked = false;

    try {
      const { ast } = parse(command);
      walkCommands(ast, (cmd) => {
        const name = cmd.words?.[0] ? wordToString(cmd.words[0]) : undefined;
        if (!name) return false;

        if (BLOCKED_COMMANDS.has(name)) {
          detectedCommand = name;
          isBlocked = true;
          return true;
        }
        if (PYTHON_COMMANDS.has(name)) {
          detectedCommand = name;
          return true;
        }
        return false;
      });
    } catch {
      const match = PYTHON_PATTERN.exec(command);
      if (match?.[1]) {
        detectedCommand = match[1];
        isBlocked = BLOCKED_COMMANDS.has(detectedCommand);
      }
    }

    if (!detectedCommand) return;

    // Always block poetry/pyenv/virtualenv
    if (isBlocked) {
      ctx.ui.notify(
        `Blocked ${detectedCommand} command. Use uv instead.`,
        "warning",
      );

      const reason =
        "This tool is not supported. Use uv for Python package management instead. " +
        "Run `uv init` to create a new Python project, " +
        "or `uv run python` to run Python scripts. " +
        "Use `uv add` to install packages (replaces pip/poetry).";

      return { block: true, reason };
    }

    // For python/pip: check if we're in a uv project
    const pyprojectPath = resolve(process.cwd(), "pyproject.toml");
    if (existsSync(pyprojectPath)) {
      // uv project exists -- let the command through, rewriter handles it
      return;
    }

    // No uv project: ask for confirmation
    if (!ctx.hasUI) {
      return {
        block: true,
        reason:
          "No uv project found (no pyproject.toml). " +
          "Run `uv init` to create one, or use `uv run python` directly.",
      };
    }

    const confirmed = await ctx.ui.confirm(
      "No pyproject.toml found",
      "No uv project found in this directory. Run python command directly?",
    );

    if (!confirmed) {
      return {
        block: true,
        reason:
          "No uv project found. Run `uv init` to create a Python project, " +
          "then use `uv run python` to run scripts or `uv add` to install packages.",
      };
    }

    // User confirmed -- let it through, rewriter will wrap in uv
    return;
  });
}
