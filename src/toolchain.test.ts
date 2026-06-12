import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { registerBashIntegration } from "../extensions/toolchain/hooks/bash-integration";
import {
  hasRewriteFeatures,
  registerToolCallHandler,
} from "../extensions/toolchain/hooks/tool-call";
import {
  BASH_SPAWN_HOOK_REQUEST_EVENT,
  TOOLCHAIN_SPAWN_HOOK_CONTRIBUTOR_ID,
} from "../extensions/toolchain/utils/bash-composition";
import {
  DEFAULT_CONFIG,
  type ResolvedToolchainConfig,
  resolveToolchainConfig,
  type ToolchainConfig,
} from "./config";
import {
  CURRENT_VERSION,
  isMissingBashSourceMode,
  migrateV0,
} from "./config/migration";
import { analyzeRewrite } from "./rules";

function createPiStub() {
  const toolCallHandlers: Array<Parameters<ExtensionAPI["on"]>[1]> = [];
  const eventHandlers = new Map<string, (data: unknown) => void>();
  const registeredTools: unknown[] = [];

  const pi = {
    on(eventName: string, handler: Parameters<ExtensionAPI["on"]>[1]) {
      if (eventName === "tool_call") {
        toolCallHandlers.push(handler);
      }
    },
    registerTool(tool: unknown) {
      registeredTools.push(tool);
    },
    events: {
      on(eventName: string, handler: (data: unknown) => void) {
        eventHandlers.set(eventName, handler);
      },
    },
  } as unknown as ExtensionAPI;

  return { pi, toolCallHandlers, eventHandlers, registeredTools };
}

function withConfig(partial: ToolchainConfig): ResolvedToolchainConfig {
  return resolveToolchainConfig(partial);
}

describe("toolchain bash source mode", () => {
  it("defaults bash.sourceMode to override-bash", () => {
    const resolved = resolveToolchainConfig({
      features: { enforcePackageManager: "rewrite" },
    });

    expect(resolved.bash.sourceMode).toBe("override-bash");
  });

  it("rejects invalid bash.sourceMode", () => {
    expect(() =>
      resolveToolchainConfig({
        bash: {
          sourceMode: "wrong-mode" as "override-bash",
        },
      }),
    ).toThrow(/bash\.sourceMode must be "override-bash" or "composed-bash"/);
  });

  it("migrateV0 handles legacy feature migration and leaves sourceMode to the dedicated migration", () => {
    const migrated = migrateV0({
      enabled: true,
      features: {
        enforcePackageManager: true as unknown as never,
      },
    });

    expect(migrated.bash?.sourceMode).toBeUndefined();
    expect(isMissingBashSourceMode(migrated)).toBe(true);
    expect(migrated.version).toBe(CURRENT_VERSION);
    expect(migrated.features?.enforcePackageManager).toBe("rewrite");
  });

  it("does not run missing-source-mode migration when sourceMode already exists", () => {
    const config = {
      version: "0.5.1-old",
      bash: { sourceMode: "composed-bash" },
    } satisfies ToolchainConfig;

    expect(isMissingBashSourceMode(config)).toBe(false);
    expect(resolveToolchainConfig(config).bash.sourceMode).toBe(
      "composed-bash",
    );
  });

  it("hasRewriteFeatures is false when no rewrite feature is enabled", () => {
    const config = withConfig({
      features: {
        enforcePackageManager: "block",
        rewritePython: "disabled",
        gitRebaseEditor: "disabled",
      },
    });

    expect(hasRewriteFeatures(config)).toBe(false);
  });

  it("registers local bash in override-bash mode", () => {
    const { pi, eventHandlers, registeredTools } = createPiStub();
    const config = withConfig({
      features: { enforcePackageManager: "rewrite" },
      bash: { sourceMode: "override-bash" },
    });

    registerBashIntegration(pi, config);

    expect(registeredTools).toHaveLength(1);
    expect(eventHandlers.has(BASH_SPAWN_HOOK_REQUEST_EVENT)).toBe(false);
  });

  it("contributes to composer in composed-bash mode", () => {
    const { pi, eventHandlers, registeredTools } = createPiStub();
    const config = withConfig({
      features: { enforcePackageManager: "rewrite" },
      bash: { sourceMode: "composed-bash" },
    });

    registerBashIntegration(pi, config);

    expect(registeredTools).toHaveLength(0);
    const handler = eventHandlers.get(BASH_SPAWN_HOOK_REQUEST_EVENT);
    expect(handler).toBeTypeOf("function");

    const contributions: Array<{ id: string; spawnHook: unknown }> = [];
    handler?.({
      register(contributor: { id: string; spawnHook: unknown }) {
        contributions.push(contributor);
      },
    });

    expect(contributions).toHaveLength(1);
    expect(contributions[0]?.id).toBe(TOOLCHAIN_SPAWN_HOOK_CONTRIBUTOR_ID);
    expect(contributions[0]?.spawnHook).toBeTypeOf("function");
  });

  it("rewrite notifications include source-mode prefix", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { gitRebaseEditor: "rewrite" },
      bash: { sourceMode: "composed-bash" },
      ui: { showRewriteNotifications: true },
    });

    registerToolCallHandler(pi, config);

    expect(toolCallHandlers).toHaveLength(1);

    const messages: string[] = [];
    await toolCallHandlers[0](
      {
        toolName: "bash",
        input: { command: "git rebase -i HEAD~1" },
      } as never,
      {
        ui: {
          notify(message: string) {
            messages.push(message);
          },
        },
      } as never,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0] ?? "").toMatch(/^\[composed-bash\] /);
  });

  it("DEFAULT_CONFIG keeps backward-compatible override-bash behavior", () => {
    expect(DEFAULT_CONFIG.bash.sourceMode).toBe("override-bash");
  });
});

describe("pure rewrite engine", () => {
  it("prefixes git rebase editor env vars in rewrite output", () => {
    const config = withConfig({
      features: { gitRebaseEditor: "rewrite" },
    });

    const result = analyzeRewrite(
      { command: "git rebase -i HEAD~1", env: {} },
      config,
    );

    expect(result.command).toBe(
      "export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=:; git rebase -i HEAD~1",
    );
  });

  it("does not prefix git rebase when editor env already exists", () => {
    const config = withConfig({
      features: { gitRebaseEditor: "rewrite" },
    });

    const result = analyzeRewrite(
      {
        command: "git rebase -i HEAD~1",
        env: { GIT_EDITOR: "vim" },
      },
      config,
    );

    expect(result.command).toBe("git rebase -i HEAD~1");
  });

  it("rewrites package manager commands", () => {
    const config = withConfig({
      features: { enforcePackageManager: "rewrite" },
      packageManager: { selected: "pnpm" },
    });

    const result = analyzeRewrite({ command: "npm install" }, config);

    expect(result.command).toBe("pnpm install");
    expect(result.notices).toHaveLength(1);
  });

  it("rewrites python commands", () => {
    const config = withConfig({
      features: { rewritePython: "rewrite" },
    });

    const result = analyzeRewrite({ command: "python script.py" }, config);

    expect(result.command).toBe("uv run python script.py");
    expect(result.notices).toHaveLength(1);
  });

  it("returns command unchanged when no rewrite features enabled", () => {
    const config = withConfig({
      features: {
        enforcePackageManager: "disabled",
        rewritePython: "disabled",
        gitRebaseEditor: "disabled",
      },
    });

    const result = analyzeRewrite({ command: "npm install" }, config);

    expect(result.command).toBe("npm install");
    expect(result.notices).toHaveLength(0);
  });
});
