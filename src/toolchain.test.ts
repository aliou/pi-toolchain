import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  hasMutationFeatures,
  hasToolCallFeatures,
  registerToolCallHandler,
} from "../extensions/toolchain/hooks/tool-call";
import {
  DEFAULT_CONFIG,
  type ResolvedToolchainConfig,
  resolveToolchainConfig,
  type ToolchainConfig,
} from "./config";
import {
  CURRENT_VERSION,
  hasStaleBashConfig,
  migrateRemoveBashConfig,
  migrateRenameKeys,
  migrateV0,
  needsKeyRename,
} from "./config/migration";
import { analyzeRewrite } from "./rules";

function createPiStub() {
  const toolCallHandlers: Array<Parameters<ExtensionAPI["on"]>[1]> = [];

  const pi = {
    on(eventName: string, handler: Parameters<ExtensionAPI["on"]>[1]) {
      if (eventName === "tool_call") {
        toolCallHandlers.push(handler);
      }
    },
  } as unknown as ExtensionAPI;

  return { pi, toolCallHandlers };
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

  it("DEFAULT_CONFIG has mutation surface", () => {
    expect(DEFAULT_CONFIG.features.packageManager).toBe("disabled");
    expect(DEFAULT_CONFIG.features.python).toBe("disabled");
    expect(DEFAULT_CONFIG.features.gitRebaseEditor).toBe("mutate");
    expect(DEFAULT_CONFIG.ui.showMutationNotifications).toBe(false);
    expect("bash" in DEFAULT_CONFIG).toBe(false);
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

  it("resolves v0 config through migration chain", () => {
    // Simulate the migration chain: v0 -> rename-keys
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

    // Step 2: rename keys
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

  it("hasStaleBashConfig detects stale bash key", () => {
    expect(
      hasStaleBashConfig({
        version: CURRENT_VERSION,
        bash: { sourceMode: "override-bash" },
      } as unknown as ToolchainConfig),
    ).toBe(true);
  });

  it("hasStaleBashConfig returns false for current schema", () => {
    expect(hasStaleBashConfig({ version: CURRENT_VERSION })).toBe(false);
  });

  it("migrateRemoveBashConfig strips stale bash key", () => {
    const migrated = migrateRemoveBashConfig({
      version: "0.6.0-20260612",
      bash: { sourceMode: "composed-bash" },
    } as unknown as ToolchainConfig);

    expect((migrated as Record<string, unknown>).bash).toBeUndefined();
    expect(migrated.version).toBe(CURRENT_VERSION);
  });

  it("resolveToolchainConfig strips stale bash key from old configs", () => {
    const resolved = resolveToolchainConfig({
      bash: { sourceMode: "override-bash" },
    } as unknown as ToolchainConfig);

    expect(
      (resolved as unknown as Record<string, unknown>).bash,
    ).toBeUndefined();
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

  it("hasToolCallFeatures is true when mutation features are enabled", () => {
    const config = withConfig({
      features: { gitRebaseEditor: "mutate" },
      ui: { showMutationNotifications: false },
    });

    expect(hasToolCallFeatures(config)).toBe(true);
  });

  it("hasToolCallFeatures is true when block features are enabled", () => {
    const config = withConfig({
      features: { packageManager: "block" },
    });

    expect(hasToolCallFeatures(config)).toBe(true);
  });

  it("hasToolCallFeatures is true when notifications are enabled", () => {
    const config = withConfig({
      features: { packageManager: "disabled" },
      ui: { showMutationNotifications: true },
    });

    expect(hasToolCallFeatures(config)).toBe(true);
  });

  it("hasToolCallFeatures is false when nothing is active", () => {
    const config = withConfig({
      features: {
        packageManager: "disabled",
        python: "disabled",
        gitRebaseEditor: "disabled",
      },
      ui: { showMutationNotifications: false },
    });

    expect(hasToolCallFeatures(config)).toBe(false);
  });
});

// --- tool_call hook ---

describe("tool_call hook", () => {
  it("mutates event.input.command in place for mutate features", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { gitRebaseEditor: "mutate" },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "git rebase -i HEAD~1" },
    };

    const result = await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(result).toBeUndefined();
    expect(event.input.command).toBe(
      "export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=:; git rebase -i HEAD~1",
    );
  });

  it("mutates package manager commands", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { packageManager: "mutate" },
      packageManager: { selected: "pnpm" },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "npm install" },
    };

    await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(event.input.command).toBe("pnpm install");
  });

  it("mutates python commands", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { python: "mutate" },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "python script.py" },
    };

    await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(event.input.command).toBe("uv run python script.py");
  });

  it("does not mutate when no mutate features are enabled", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: {
        packageManager: "disabled",
        python: "disabled",
        gitRebaseEditor: "disabled",
      },
      ui: { showMutationNotifications: false },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "npm install" },
    };

    await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(event.input.command).toBe("npm install");
    // Note: in production, the handler wouldn't be registered for this config
    // since hasToolCallFeatures returns false. This tests the internal guard.
  });

  it("blocks commands instead of mutating when mode is block", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { packageManager: "block" },
      packageManager: { selected: "pnpm" },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "npm install" },
    };

    const result = await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(result).toEqual({ block: true, reason: expect.any(String) });
    expect(event.input.command).toBe("npm install"); // not mutated
  });

  it("emits mutation notifications without bash source prefix", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { gitRebaseEditor: "mutate" },
      ui: { showMutationNotifications: true },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "git rebase -i HEAD~1" },
    };
    const messages: string[] = [];

    await toolCallHandlers[0](
      event as never,
      {
        ui: {
          notify(message: string) {
            messages.push(message);
          },
        },
      } as never,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0] ?? "").not.toMatch(
      /^\[(override-bash|composed-bash)\] /,
    );
    expect(messages[0]).toContain("GIT_EDITOR");
    expect(event.input.command).toContain("GIT_EDITOR=true");
  });

  it("ignores non-bash tool calls", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: { packageManager: "mutate" },
      packageManager: { selected: "pnpm" },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "read",
      input: { command: "npm install" },
    };

    const result = await toolCallHandlers[0](
      event as never,
      {
        ui: { notify() {} },
      } as never,
    );

    expect(result).toBeUndefined();
    expect(event.input.command).toBe("npm install"); // untouched
  });

  it("does not mutate or notify when showMutationNotifications is on but all features disabled", async () => {
    const { pi, toolCallHandlers } = createPiStub();
    const config = withConfig({
      features: {
        packageManager: "disabled",
        python: "disabled",
        gitRebaseEditor: "disabled",
      },
      ui: { showMutationNotifications: true },
    });

    registerToolCallHandler(pi, config);

    const event = {
      toolName: "bash",
      input: { command: "npm install" },
    };
    const messages: string[] = [];

    await toolCallHandlers[0](
      event as never,
      {
        ui: {
          notify(message: string) {
            messages.push(message);
          },
        },
      } as never,
    );

    expect(messages).toHaveLength(0);
    expect(event.input.command).toBe("npm install");
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
