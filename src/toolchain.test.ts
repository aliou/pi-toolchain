import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { registerBashIntegration } from "../extensions/toolchain/hooks/bash-integration";
import {
  hasMutationFeatures,
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
  migrateMissingBashSourceMode,
  migrateRenameKeys,
  migrateV0,
  needsKeyRename,
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

// --- Config defaults ---

describe("toolchain config defaults", () => {
  it("defaults gitRebaseEditor to mutate", () => {
    const resolved = resolveToolchainConfig({});
    expect(resolved.features.gitRebaseEditor).toBe("mutate");
  });

  it("defaults packageManager and python to disabled", () => {
    const resolved = resolveToolchainConfig({});
    expect(resolved.features.packageManager).toBe("disabled");
    expect(resolved.features.python).toBe("disabled");
  });

  it("defaults bash.sourceMode to override-bash", () => {
    const resolved = resolveToolchainConfig({});
    expect(resolved.bash.sourceMode).toBe("override-bash");
  });

  it("DEFAULT_CONFIG has mutation surface", () => {
    expect(DEFAULT_CONFIG.features.packageManager).toBe("disabled");
    expect(DEFAULT_CONFIG.features.python).toBe("disabled");
    expect(DEFAULT_CONFIG.features.gitRebaseEditor).toBe("mutate");
    expect(DEFAULT_CONFIG.ui.showMutationNotifications).toBe(false);
    expect(DEFAULT_CONFIG.bash.sourceMode).toBe("override-bash");
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

  it("rejects gitRebaseEditor block mode", () => {
    expect(() =>
      resolveToolchainConfig({
        features: { gitRebaseEditor: "block" },
      }),
    ).toThrow(/gitRebaseEditor must be "disabled" or "mutate"/);
  });
});

// --- Migration ---

describe("toolchain migration", () => {
  it("migrateV0 maps boolean true to mutate", () => {
    const migrated = migrateV0({
      enabled: true,
      features: {
        enforcePackageManager: true,
      } as unknown as ToolchainConfig["features"],
    });

    // v0 migration still uses old key names; rename migration handles those
    expect(
      (migrated.features as Record<string, unknown>).enforcePackageManager,
    ).toBe("mutate");
  });

  it("migrateV0 maps boolean false to disabled", () => {
    const migrated = migrateV0({
      enabled: true,
      features: {
        enforcePackageManager: false,
      } as unknown as ToolchainConfig["features"],
    });

    expect(
      (migrated.features as Record<string, unknown>).enforcePackageManager,
    ).toBe("disabled");
  });

  it("migrateRenameKeys renames enforcePackageManager -> packageManager with mutate mode", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        enforcePackageManager: "rewrite",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.packageManager).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).enforcePackageManager,
    ).toBeUndefined();
  });

  it("migrateRenameKeys renames rewritePython -> python with mutate mode", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        rewritePython: "rewrite",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.python).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).rewritePython,
    ).toBeUndefined();
  });

  it("migrateRenameKeys mutates gitRebaseEditor rewrite -> mutate", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        gitRebaseEditor: "rewrite" as unknown as never,
      },
    });

    expect(migrated.features?.gitRebaseEditor).toBe("mutate");
  });

  it("migrateRenameKeys migrates ui.showRewriteNotifications -> showMutationNotifications", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      ui: {
        showRewriteNotifications: true,
      } as unknown as ToolchainConfig["ui"],
    });

    expect(migrated.ui?.showMutationNotifications).toBe(true);
    expect(
      (migrated.ui as Record<string, unknown>).showRewriteNotifications,
    ).toBeUndefined();
  });

  it("migrateRenameKeys preserves new keys when both old and new exist", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        enforcePackageManager: "disabled",
        packageManager: "mutate",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.packageManager).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).enforcePackageManager,
    ).toBeUndefined();
  });

  it("migrateRenameKeys leaves non-rewrite modes unchanged", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        enforcePackageManager: "block",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.packageManager).toBe("block");
  });

  it("needsKeyRename detects old keys", () => {
    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        features: {
          enforcePackageManager: "disabled",
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);
  });

  it("needsKeyRename detects rewrite mode value", () => {
    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        features: {
          packageManager: "rewrite",
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);
  });

  it("needsKeyRename detects old ui key", () => {
    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        ui: {
          showRewriteNotifications: true,
        } as unknown as ToolchainConfig["ui"],
      }),
    ).toBe(true);
  });

  it("needsKeyRename returns false for current schema", () => {
    expect(
      needsKeyRename({
        version: CURRENT_VERSION,
        features: { packageManager: "mutate" },
      }),
    ).toBe(false);
  });

  it("isMissingBashSourceMode detects missing sourceMode", () => {
    expect(isMissingBashSourceMode({ version: CURRENT_VERSION })).toBe(true);
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

  it("resolves v0 config through migration chain", () => {
    // Simulate the migration chain: v0 -> add-bash-source-mode -> rename-keys
    let config: ToolchainConfig = {
      enabled: true,
      features: {
        enforcePackageManager: true,
      } as unknown as ToolchainConfig["features"],
    };

    // Step 1: v0 migration (boolean -> FeatureMode)
    config = migrateV0(config);
    expect(
      (config.features as Record<string, unknown>).enforcePackageManager,
    ).toBe("mutate");

    // Step 2: add-bash-source-mode
    config = migrateMissingBashSourceMode(config);
    expect(config.bash?.sourceMode).toBe("override-bash");

    // Step 3: rename keys
    expect(needsKeyRename(config)).toBe(true);
    config = migrateRenameKeys(config);
    expect(config.features?.packageManager).toBe("mutate");
    expect(
      (config.features as Record<string, unknown>).enforcePackageManager,
    ).toBeUndefined();

    // Final: resolve defaults
    const resolved = resolveToolchainConfig(config);
    expect(resolved.features.packageManager).toBe("mutate");
  });
});

// --- Feature predicates ---

describe("feature predicates", () => {
  it("hasMutationFeatures is true when a feature is in mutate mode", () => {
    const config = withConfig({
      features: { packageManager: "mutate" },
    });
    expect(hasMutationFeatures(config)).toBe(true);
  });

  it("hasMutationFeatures is false when no mutate feature is enabled", () => {
    const config = withConfig({
      features: {
        packageManager: "block",
        python: "disabled",
        gitRebaseEditor: "disabled",
      },
    });

    expect(hasMutationFeatures(config)).toBe(false);
  });
});

// --- Bash integration (Phase 3: still working, Phase 4 removes) ---

describe("toolchain bash source mode", () => {
  it("registers local bash in override-bash mode", () => {
    const { pi, eventHandlers, registeredTools } = createPiStub();
    const config = withConfig({
      features: { packageManager: "mutate" },
      bash: { sourceMode: "override-bash" },
    });

    registerBashIntegration(pi, config);

    expect(registeredTools).toHaveLength(1);
    expect(eventHandlers.has(BASH_SPAWN_HOOK_REQUEST_EVENT)).toBe(false);
  });

  it("contributes to composer in composed-bash mode", () => {
    const { pi, eventHandlers, registeredTools } = createPiStub();
    const config = withConfig({
      features: { packageManager: "mutate" },
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

  it("mutation notifications include source-mode prefix", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { gitRebaseEditor: "mutate" },
      bash: { sourceMode: "composed-bash" },
      ui: { showMutationNotifications: true },
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
});

// --- Pure rewrite/mutation engine ---

describe("pure mutation engine", () => {
  it("prefixes git rebase editor env vars in mutate output", () => {
    const config = withConfig({
      features: { gitRebaseEditor: "mutate" },
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
      features: { gitRebaseEditor: "mutate" },
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

  it("mutates package manager commands", () => {
    const config = withConfig({
      features: { packageManager: "mutate" },
      packageManager: { selected: "pnpm" },
    });

    const result = analyzeRewrite({ command: "npm install" }, config);

    expect(result.command).toBe("pnpm install");
    expect(result.notices).toHaveLength(1);
  });

  it("mutates python commands", () => {
    const config = withConfig({
      features: { python: "mutate" },
    });

    const result = analyzeRewrite({ command: "python script.py" }, config);

    expect(result.command).toBe("uv run python script.py");
    expect(result.notices).toHaveLength(1);
  });

  it("returns command unchanged when no mutate features enabled", () => {
    const config = withConfig({
      features: {
        packageManager: "disabled",
        python: "disabled",
        gitRebaseEditor: "disabled",
      },
    });

    const result = analyzeRewrite({ command: "npm install" }, config);

    expect(result.command).toBe("npm install");
    expect(result.notices).toHaveLength(0);
  });
});
