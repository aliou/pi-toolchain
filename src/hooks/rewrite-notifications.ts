import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ResolvedToolchainConfig } from "../config";
import { analyzeRewrite } from "../rewriters";
import { formatRewriteSourcePrefix } from "../utils/bash-composition";

export function registerRewriteNotifications(
  pi: ExtensionAPI,
  config: ResolvedToolchainConfig,
): void {
  if (!config.ui.showRewriteNotifications) return;

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");
    if (!command) return;

    const rewriteResult = analyzeRewrite(
      {
        command,
        cwd: process.cwd(),
        env: process.env,
      },
      config,
    );

    const prefix = formatRewriteSourcePrefix(config.bash.sourceMode);
    for (const notice of rewriteResult.notices) {
      ctx.ui.notify(`${prefix} ${notice.message}`, "warning");
    }

    return undefined;
  });
}

export function hasRewriteFeatures(config: ResolvedToolchainConfig): boolean {
  return (
    config.features.enforcePackageManager === "rewrite" ||
    config.features.rewritePython === "rewrite" ||
    config.features.gitRebaseEditor === "rewrite"
  );
}
