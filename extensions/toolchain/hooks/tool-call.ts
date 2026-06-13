/**
 * Combined tool_call handler for blockers and mutation notifications.
 *
 * Blockers run first. A blocked command never reaches the mutation
 * notification check. Only features with mode "block" or notifications
 * enabled register here.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../../../src/config";
import { analyzeRewrite } from "../../../src/rules";
import { detectForeignPackageManager } from "../../../src/rules/package-manager";
import { detectPythonCommand } from "../../../src/rules/python";

// --- Blocker detection ---

interface BlockResult {
  notification: string;
  reason: string;
}

function checkPackageManagerBlocker(
  command: string,
  config: ResolvedToolchainConfig,
): BlockResult | null {
  if (config.features.packageManager !== "block") return null;

  const detected = detectForeignPackageManager(
    command,
    config.packageManager.selected,
  );
  if (!detected) return null;

  const selected = config.packageManager.selected;
  return {
    notification: `Blocked ${detected} command. Use ${selected} instead.`,
    reason:
      `This project uses ${selected} as the package manager. ` +
      `Replace \`${detected}\` with \`${selected}\` ` +
      `(or \`${selected} dlx\` for npx-style commands).`,
  };
}

function checkPythonBlocker(
  command: string,
  config: ResolvedToolchainConfig,
): BlockResult | null {
  if (config.features.python !== "block") return null;

  const detected = detectPythonCommand(command);
  if (!detected) return null;

  return {
    notification: `Blocked ${detected} command. Use uv instead.`,
    reason:
      "Use uv for Python package management instead. " +
      "Run `uv init` to create a new Python project, " +
      "`uv run python` to run Python scripts, " +
      "or `uv add` to install packages (replaces pip/poetry).",
  };
}

function checkBlockers(
  command: string,
  config: ResolvedToolchainConfig,
): BlockResult | null {
  return (
    checkPackageManagerBlocker(command, config) ??
    checkPythonBlocker(command, config)
  );
}

// --- Extension hook ---

export function registerToolCallHandler(
  pi: ExtensionAPI,
  config: ResolvedToolchainConfig,
): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");
    if (!command) return;

    // Blockers first
    const blocked = checkBlockers(command, config);
    if (blocked) {
      ctx.ui.notify(blocked.notification, "warning");
      return { block: true, reason: blocked.reason };
    }

    // Mutation notifications
    if (config.ui.showMutationNotifications) {
      // NOTE: process.env is used here while the spawn hook path used ctx.env.
      // They can diverge if Pi augments ctx.env for a given execution.
      // Phase 5 will unify this by mutating event.input.command directly.
      const rewriteResult = analyzeRewrite(
        {
          command,
          env: process.env,
        },
        config,
      );

      for (const notice of rewriteResult.notices) {
        ctx.ui.notify(notice.message, "warning");
      }
    }

    return undefined;
  });
}

export function hasToolCallFeatures(config: ResolvedToolchainConfig): boolean {
  return (
    config.features.packageManager === "block" ||
    config.features.python === "block" ||
    config.ui.showMutationNotifications
  );
}

// Phase 5: used to gate event.input.command mutation in tool_call handler
export function hasMutationFeatures(config: ResolvedToolchainConfig): boolean {
  return (
    config.features.packageManager === "mutate" ||
    config.features.python === "mutate" ||
    config.features.gitRebaseEditor === "mutate"
  );
}
