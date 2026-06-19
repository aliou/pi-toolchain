import { describe, expect, it } from "vitest";
import { resolveToolchainConfig, type ToolchainConfig } from "../config";
import {
  CURRENT_VERSION,
  hasStaleBashConfig,
  migrateRemoveBashConfig,
  migrateRenameKeys,
  migrateV0,
  needsKeyRename,
  v0Message,
} from "./migration";

describe("migration: v0 boolean -> FeatureMode", () => {
  it("maps boolean true to mutate", () => {
    const migrated = migrateV0({
      enabled: true,
      features: {
        enforcePackageManager: true,
      } as unknown as ToolchainConfig["features"],
    });

    expect(
      (migrated.features as Record<string, unknown>).enforcePackageManager,
    ).toBe("mutate");
  });

  it("maps boolean false to disabled", () => {
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

  it("strips removed features (preventBrew, preventDockerSecrets)", () => {
    const migrated = migrateV0({
      enabled: true,
      features: {
        preventBrew: true,
        preventDockerSecrets: true,
      } as unknown as ToolchainConfig["features"],
    });

    expect(
      (migrated.features as Record<string, unknown>).preventBrew,
    ).toBeUndefined();
    expect(
      (migrated.features as Record<string, unknown>).preventDockerSecrets,
    ).toBeUndefined();
  });
});

describe("migration: v0Message", () => {
  it("mentions removed features when present", () => {
    const msg = v0Message({
      features: {
        preventBrew: true,
      } as unknown as ToolchainConfig["features"],
    });

    expect(msg).toContain("preventBrew");
    expect(msg).toContain("pi-guardrails");
  });

  it("mentions guardrails even without removed features", () => {
    const msg = v0Message({ features: {} });

    expect(msg).toContain("pi-guardrails");
  });
});

describe("migration: rename keys + mutate mode", () => {
  it("renames enforcePackageManager -> nodePackageManager with mutate mode", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        enforcePackageManager: "rewrite",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.nodePackageManager).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).enforcePackageManager,
    ).toBeUndefined();
  });

  it("renames packageManager -> nodePackageManager (intermediate key)", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        packageManager: "mutate",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.nodePackageManager).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).packageManager,
    ).toBeUndefined();
  });

  it("renames rewritePython -> pythonToUv with mutate mode", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        rewritePython: "rewrite",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.pythonToUv).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).rewritePython,
    ).toBeUndefined();
  });

  it("renames python -> pythonToUv (intermediate key)", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        python: "mutate",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.pythonToUv).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).python,
    ).toBeUndefined();
  });

  it("renames gitRebaseEditor -> nonInteractiveGitRebase", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        gitRebaseEditor: "rewrite",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.nonInteractiveGitRebase).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).gitRebaseEditor,
    ).toBeUndefined();
  });

  it("migrates ui.showRewriteNotifications -> showMutationNotifications", () => {
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

  it("preserves new keys when both old and new exist", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        enforcePackageManager: "disabled",
        nodePackageManager: "mutate",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.nodePackageManager).toBe("mutate");
    expect(
      (migrated.features as Record<string, unknown>).enforcePackageManager,
    ).toBeUndefined();
  });

  it("leaves non-rewrite modes unchanged", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        enforcePackageManager: "block",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.nodePackageManager).toBe("block");
  });

  it("maps current-key booleans to feature modes", () => {
    const migrated = migrateRenameKeys({
      version: "0.7.0-20260614",
      features: {
        nodePackageManager: false,
        pythonToUv: true,
        nonInteractiveGitRebase: false,
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.nodePackageManager).toBe("disabled");
    expect(migrated.features?.pythonToUv).toBe("mutate");
    expect(migrated.features?.nonInteractiveGitRebase).toBe("disabled");
  });

  it("moves packageManager.selected -> nodePackageManager.selected", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      packageManager: { selected: "bun" },
    } as unknown as ToolchainConfig);

    expect((migrated as Record<string, unknown>).nodePackageManager).toEqual({
      selected: "bun",
    });
    expect(
      (migrated as Record<string, unknown>).packageManager,
    ).toBeUndefined();
  });
});

describe("migration: needsKeyRename detector", () => {
  it("detects old keys (enforcePackageManager, rewritePython)", () => {
    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        features: {
          enforcePackageManager: "disabled",
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);
  });

  it("detects intermediate keys (packageManager, python, gitRebaseEditor)", () => {
    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        features: {
          packageManager: "mutate",
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);

    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        features: {
          python: "mutate",
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);

    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        features: {
          gitRebaseEditor: "mutate",
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);
  });

  it("detects rewrite mode value", () => {
    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        features: {
          nodePackageManager: "rewrite",
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);
  });

  it("detects boolean mode value", () => {
    expect(
      needsKeyRename({
        version: "0.7.0-20260614",
        features: {
          nodePackageManager: false,
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);
  });

  it("detects old ui key", () => {
    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        ui: {
          showRewriteNotifications: true,
        } as unknown as ToolchainConfig["ui"],
      }),
    ).toBe(true);
  });

  it("detects stale top-level packageManager key", () => {
    expect(
      needsKeyRename({
        version: "0.5.2-20260331",
        packageManager: { selected: "pnpm" },
      } as unknown as ToolchainConfig),
    ).toBe(true);
  });

  it("returns false for current schema", () => {
    expect(
      needsKeyRename({
        version: CURRENT_VERSION,
        features: { nodePackageManager: "mutate" },
      }),
    ).toBe(false);
  });
});

describe("migration: remove-bash-config", () => {
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
});

describe("migration: full chain", () => {
  it("resolves v0 config through migration chain", () => {
    let config: ToolchainConfig = {
      enabled: true,
      features: {
        enforcePackageManager: true,
      } as unknown as ToolchainConfig["features"],
    };

    config = migrateV0(config);
    expect(
      (config.features as Record<string, unknown>).enforcePackageManager,
    ).toBe("mutate");

    expect(needsKeyRename(config)).toBe(true);
    config = migrateRenameKeys(config);
    expect(config.features?.nodePackageManager).toBe("mutate");
    expect(
      (config.features as Record<string, unknown>).enforcePackageManager,
    ).toBeUndefined();

    const resolved = resolveToolchainConfig(config);
    expect(resolved.features.nodePackageManager).toBe("mutate");
  });

  it("resolves version-stamped boolean config through migration chain", () => {
    let config: ToolchainConfig = {
      version: "0.7.0-20260614",
      features: {
        nodePackageManager: false,
        pythonToUv: false,
        nonInteractiveGitRebase: "mutate",
      } as unknown as ToolchainConfig["features"],
    };

    expect(needsKeyRename(config)).toBe(true);
    config = migrateRenameKeys(config);

    const resolved = resolveToolchainConfig(config);
    expect(resolved.features.nodePackageManager).toBe("disabled");
    expect(resolved.features.pythonToUv).toBe("disabled");
    expect(resolved.features.nonInteractiveGitRebase).toBe("mutate");
  });
});
