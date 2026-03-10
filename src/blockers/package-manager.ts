/**
 * Package manager blocker.
 *
 * Used when enforcePackageManager is set to "block" instead of "rewrite".
 * Blocks commands using a non-selected package manager and tells the model
 * to use the configured one instead.
 *
 * Uses AST-based matching. Falls back to regex on parse failure.
 */

import { parse } from "@aliou/sh";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config";
import { walkCommands, wordToString } from "../utils/shell-utils";

const ALL_MANAGERS = new Set(["bun", "pnpm", "npm", "npx", "yarn"]);

export function setupPackageManagerBlocker(
  pi: ExtensionAPI,
  config: ResolvedToolchainConfig,
): void {
  const selected = config.packageManager.selected;

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");

    let detected: string | null = null;
    try {
      const { ast } = parse(command);
      walkCommands(ast, (cmd) => {
        const name = cmd.words?.[0] ? wordToString(cmd.words[0]) : undefined;
        if (name && ALL_MANAGERS.has(name) && name !== selected) {
          detected = name;
          return true;
        }
        return false;
      });
    } catch {
      for (const mgr of ALL_MANAGERS) {
        if (mgr !== selected && new RegExp(`\\b${mgr}\\b`).test(command)) {
          detected = mgr;
          break;
        }
      }
    }

    if (!detected) return;

    ctx.ui.notify(
      `Blocked ${detected} command. Use ${selected} instead.`,
      "warning",
    );

    const reason =
      `This project uses ${selected} as the package manager. ` +
      `Replace \`${detected}\` with \`${selected}\` (or \`${selected} dlx\` for npx-style commands).`;

    return { block: true, reason };
  });
}
