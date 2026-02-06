/**
 * Blocks docker commands commonly used to read container environment secrets.
 *
 * Blocked patterns:
 * - docker inspect ... (includes Config.Env)
 * - docker exec ... env|printenv
 * - docker exec ... cat /proc/<pid>/environ
 *
 * Uses AST-based matching to avoid false positives. Falls back to regex
 * matching on parse failure.
 */

import { parse } from "@aliou/sh";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { walkCommands, wordToString } from "../utils/shell-utils";

const FALLBACK_PATTERN =
  /\bdocker\s+(?:inspect\b|exec\b[^\n]*(?:\bprintenv\b|\benv\b|\/proc\/[^\s]*\/environ\b))/i;

function shouldBlockDockerCommand(words: string[]): boolean {
  if (words[0] !== "docker") return false;

  const subcommand = words[1];
  if (!subcommand) return false;

  if (subcommand === "inspect") {
    return true;
  }

  if (subcommand !== "exec") {
    return false;
  }

  for (let i = 2; i < words.length; i++) {
    const token = words[i];
    if (!token) continue;

    if (token === "env" || token === "printenv") {
      return true;
    }

    if (token.includes("/proc/") && token.includes("/environ")) {
      return true;
    }
  }

  return false;
}

export function setupDockerSecretsBlocker(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");

    let shouldBlock = false;

    try {
      const { ast } = parse(command);
      walkCommands(ast, (cmd) => {
        const words = (cmd.words ?? []).map(wordToString);
        if (shouldBlockDockerCommand(words)) {
          shouldBlock = true;
          return true;
        }
        return false;
      });
    } catch {
      shouldBlock = FALLBACK_PATTERN.test(command);
    }

    if (!shouldBlock) return;

    ctx.ui.notify(
      "Blocked docker command that may expose environment secrets.",
      "warning",
    );

    const reason =
      "This docker command can expose container environment variables/secrets " +
      "(e.g. DATABASE_URL, tokens, passwords). Ask the user to run it manually " +
      "and share only the specific non-sensitive value needed.";

    return { block: true, reason };
  });
}
