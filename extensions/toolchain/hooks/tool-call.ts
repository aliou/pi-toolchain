/**
 * Combined tool_call handler for blockers, command mutation, and notifications.
 *
 * Execution order:
 * 1. Blockers run first — a blocked command never reaches mutation.
 * 2. Mutation — if any feature is in "mutate" mode, analyzeRewrite()
 *    produces a rewritten command that is applied by mutating
 *    event.input.command in place.
 * 3. Notifications — if showMutationNotifications is enabled, notices
 *    from the rewrite analysis are emitted as Pi warnings.
 */

import {
  type ExtensionAPI,
  isToolCallEventType,
} from "@earendil-works/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../../../src/config";
import { analyzeRewrite } from "../../../src/rules";
import { detectNixShell } from "../../../src/rules/nix-shell";
import { detectForeignPackageManager } from "../../../src/rules/node-package-manager";
import { detectPythonCommand } from "../../../src/rules/python-to-uv";

// --- Blocker detection ---

interface BlockResult {
  notification: string;
  reason: string;
}

function checkNodePackageManagerBlocker(
  command: string,
  config: ResolvedToolchainConfig,
): BlockResult | null {
  if (config.features.nodePackageManager !== "block") return null;

  const detected = detectForeignPackageManager(
    command,
    config.nodePackageManager.selected,
  );
  if (!detected) return null;

  const selected = config.nodePackageManager.selected;
  return {
    notification: `Blocked ${detected} command. Use ${selected} instead.`,
    reason:
      `This project uses ${selected} as the package manager. ` +
      `Replace \`${detected}\` with \`${selected}\` ` +
      `(or \`${selected} dlx\` for npx-style commands).`,
  };
}

function checkPythonToUvBlocker(
  command: string,
  config: ResolvedToolchainConfig,
): BlockResult | null {
  if (config.features.pythonToUv !== "block") return null;

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

function checkNixShellBlocker(
  _command: string,
  config: ResolvedToolchainConfig,
): BlockResult | null {
  if (config.features.nixShell !== "block") return null;

  const nixType = detectNixShell(process.cwd());
  if (!nixType) return null;

  const tool = nixType === "flake" ? "nix develop" : "nix-shell";
  return {
    notification: `Blocked raw command. This project uses a nix shell.`,
    reason:
      `This project has a ${nixType === "flake" ? "flake.nix" : "shell.nix"} ` +
      `with a devShell. Use \`${tool}\` to run commands inside the nix environment.`,
  };
}

function checkBlockers(
  command: string,
  config: ResolvedToolchainConfig,
): BlockResult | null {
  return (
    checkNodePackageManagerBlocker(command, config) ??
    checkPythonToUvBlocker(command, config) ??
    checkNixShellBlocker(command, config)
  );
}

// --- Feature predicates ---

export function hasToolCallFeatures(config: ResolvedToolchainConfig): boolean {
  return (
    config.features.nodePackageManager === "block" ||
    config.features.pythonToUv === "block" ||
    config.features.nixShell === "block" ||
    hasMutationFeatures(config) ||
    config.ui.showMutationNotifications
  );
}

export function hasMutationFeatures(config: ResolvedToolchainConfig): boolean {
  return (
    config.features.nodePackageManager === "mutate" ||
    config.features.pythonToUv === "mutate" ||
    config.features.nonInteractiveGitRebase === "mutate" ||
    config.features.nixShell === "mutate"
  );
}

// --- Extension hook ---

export function registerToolCallHandler(
  pi: ExtensionAPI,
  config: ResolvedToolchainConfig,
): void {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const command = String(event.input.command ?? "");
    if (!command) return;

    // 1. Blockers first
    const blocked = checkBlockers(command, config);
    if (blocked) {
      ctx.ui.notify(blocked.notification, "warning");
      return { block: true, reason: blocked.reason };
    }

    // 2. Command mutation + notifications
    const needsRewrite =
      hasMutationFeatures(config) || config.ui.showMutationNotifications;

    if (needsRewrite) {
      // TODO: process.env may diverge from Pi's ctx.env if the session
      // augments environment variables for a given execution. Using
      // ctx.env would be more accurate but isn't currently exposed
      // in the tool_call handler context type.
      const rewriteResult = analyzeRewrite(
        {
          command,
          env: process.env,
        },
        config,
      );

      // Mutate event.input.command in place — flows through to bash execution
      if (rewriteResult.command !== command) {
        event.input.command = rewriteResult.command;
      }

      // Emit mutation notifications
      // TODO: Emit events on the event bus too
      if (config.ui.showMutationNotifications) {
        for (const notice of rewriteResult.notices) {
          ctx.ui.notify(notice.message, "warning");
        }
      }
    }

    return undefined;
  });
}
