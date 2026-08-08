import { describe, expect, it } from "vitest";
import { resolveToolchainConfig } from "../../config";
import type { ToolchainConfig } from "../types";
import {
  hasStaleBashConfig,
  isV0,
  migrateRemoveBashConfig,
  migrateRenameKeys,
  migrateV0,
  needs090Migration,
  needsKeyRename,
  v0Message,
  v090Migration,
} from "./01-v0-9-0";

describe("v0-9-0: isV0 detector", () => {
  it("returns true for config without a version field", () => {
    expect(isV0({ enabled: true } as ToolchainConfig)).toBe(true);
  });

  it("returns false once a version is stamped", () => {
    expect(isV0({ version: "0.9.0" } as ToolchainConfig)).toBe(false);
  });
});

describe("v0-9-0: migrateV0", () => {
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

  it("does not stamp version", () => {
    const migrated = migrateV0({ enabled: true } as ToolchainConfig);
    expect(migrated.version).toBeUndefined();
  });
});

describe("v0-9-0: v0Message", () => {
  it("mentions removed features when present", () => {
    const msg = v0Message({
      enabled: true,
      features: {
        preventBrew: true,
      } as unknown as ToolchainConfig["features"],
    });

    expect(msg).toContain("preventBrew");
    expect(msg).toContain("pi-guardrails");
  });

  it("mentions guardrails even without removed features", () => {
    const msg = v0Message({ enabled: true, features: {} });

    expect(msg).toContain("pi-guardrails");
  });

  it("returns undefined for non-v0 configs", () => {
    const msg = v0Message({ version: "0.9.0" } as ToolchainConfig);
    expect(msg).toBeUndefined();
  });
});

describe("v0-9-0: migrateRenameKeys", () => {
  it("renames enforcePackageManager -> nodePackageManager with mutate mode", () => {
    const migrated = migrateRenameKeys({
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
      features: {
        enforcePackageManager: "block",
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.nodePackageManager).toBe("block");
  });

  it("migrates boolean false to disabled", () => {
    const migrated = migrateRenameKeys({
      version: "0.8.1-20260612",
      features: {
        rewritePython: false,
      } as unknown as ToolchainConfig["features"],
    });

    expect(migrated.features?.pythonToUv).toBe("disabled");
  });

  it("moves top-level packageManager to nodePackageManager", () => {
    const migrated = migrateRenameKeys({
      packageManager: { selected: "npm" },
    } as unknown as ToolchainConfig);

    expect(migrated.nodePackageManager?.selected).toBe("npm");
    expect(
      (migrated as Record<string, unknown>).packageManager,
    ).toBeUndefined();
  });
});

describe("v0-9-0: needsKeyRename detector", () => {
  it("detects legacy v0 keys", () => {
    expect(
      needsKeyRename({
        features: { enforcePackageManager: "mutate" },
      } as ToolchainConfig),
    ).toBe(true);
  });

  it("detects stale intermediate keys", () => {
    expect(
      needsKeyRename({
        features: { packageManager: "mutate", python: "disabled" },
      } as ToolchainConfig),
    ).toBe(true);
  });

  it("detects leftover rewrite values", () => {
    expect(
      needsKeyRename({
        features: { nodePackageManager: "rewrite" },
      } as unknown as ToolchainConfig),
    ).toBe(true);
  });

  it("detects leftover boolean values", () => {
    expect(
      needsKeyRename({
        features: { nodePackageManager: true },
      } as unknown as ToolchainConfig),
    ).toBe(true);
  });

  it("detects stale ui key", () => {
    expect(
      needsKeyRename({
        ui: { showRewriteNotifications: true },
      } as unknown as ToolchainConfig),
    ).toBe(true);
  });

  it("detects stale top-level packageManager", () => {
    expect(
      needsKeyRename({ packageManager: {} } as unknown as ToolchainConfig),
    ).toBe(true);
  });

  it("returns false for current schema", () => {
    expect(
      needsKeyRename({
        version: "0.9.0",
        features: {
          nodePackageManager: "mutate",
          pythonToUv: "disabled",
          nonInteractiveGitRebase: "mutate",
          nixShell: "disabled",
        },
      } as ToolchainConfig),
    ).toBe(false);
  });
});

describe("v0-9-0: remove-bash-config", () => {
  it("detects stale bash key", () => {
    expect(
      hasStaleBashConfig({
        bash: { sourceMode: "override-bash" },
      } as unknown as ToolchainConfig),
    ).toBe(true);
  });

  it("returns false for current schema", () => {
    expect(hasStaleBashConfig({})).toBe(false);
  });

  it("strips stale bash key", () => {
    const migrated = migrateRemoveBashConfig({
      bash: { sourceMode: "composed-bash" },
    } as unknown as ToolchainConfig);

    expect((migrated as Record<string, unknown>).bash).toBeUndefined();
  });
});

describe("v0-9-0: migration object", () => {
  const dummyCtx = {
    filePath: "",
    appliedMigrations: [],
    fromVersion: "0.0.0",
    toVersion: "0.9.0",
  };

  it("runs on v0 configs", () => {
    expect(
      v090Migration.shouldRun?.({ enabled: true } as ToolchainConfig, dummyCtx),
    ).toBe(true);
  });

  it("runs on configs missing nixShell", () => {
    expect(
      v090Migration.shouldRun?.(
        {
          version: "0.9.0",
          features: {
            nodePackageManager: "disabled",
            pythonToUv: "disabled",
            nonInteractiveGitRebase: "mutate",
          },
        } as ToolchainConfig,
        dummyCtx,
      ),
    ).toBe(true);
  });

  it("does not run once nixShell is present", () => {
    expect(
      v090Migration.shouldRun?.(
        {
          version: "0.10.1",
          features: {
            nodePackageManager: "disabled",
            pythonToUv: "disabled",
            nonInteractiveGitRebase: "mutate",
            nixShell: "disabled",
          },
        } as ToolchainConfig,
        dummyCtx,
      ),
    ).toBe(false);
  });

  it("backfills nixShell disabled when missing", async () => {
    const migrated = await v090Migration.run(
      {
        version: "0.9.0",
        features: {
          nodePackageManager: "disabled",
          pythonToUv: "disabled",
          nonInteractiveGitRebase: "mutate",
        },
      } as ToolchainConfig,
      "",
      {
        filePath: "",
        appliedMigrations: [],
        fromVersion: "0.0.0",
        toVersion: "0.9.0",
      },
    );

    expect(migrated.features?.nixShell).toBe("disabled");
  });

  it("produces a user-facing message for v0 configs", () => {
    const { message } = v090Migration;
    expect(typeof message).toBe("function");
    if (typeof message !== "function") return;
    const msg = message(
      { enabled: true } as ToolchainConfig,
      { enabled: true } as ToolchainConfig,
      "~/path/to/config.json",
      {
        filePath: "",
        appliedMigrations: [],
        fromVersion: "0.0.0",
        toVersion: "0.9.0",
      },
    );
    expect(typeof msg).toBe("string");
    expect(msg).toContain("/toolchain:settings");
  });
});

describe("v0-9-0: full migration chain", () => {
  it("resolves v0 config through full migration chain", async () => {
    const config: ToolchainConfig = {
      enabled: true,
      features: {
        enforcePackageManager: true,
      } as unknown as ToolchainConfig["features"],
    };

    const migrated = await v090Migration.run(config, "", {
      filePath: "",
      appliedMigrations: [],
      fromVersion: "0.0.0",
      toVersion: "0.9.0",
    });

    expect(migrated.features?.nodePackageManager).toBe("mutate");
    const resolved = resolveToolchainConfig(migrated);
    expect(resolved.features.nodePackageManager).toBe("mutate");
  });

  it("resolves version-stamped boolean config through migration chain", async () => {
    const config: ToolchainConfig = {
      version: "0.7.0-20260614",
      features: {
        nodePackageManager: false,
        pythonToUv: false,
        nonInteractiveGitRebase: "mutate",
      } as unknown as ToolchainConfig["features"],
    };

    expect(needsKeyRename(config)).toBe(true);
    const migrated = await v090Migration.run(config, "", {
      filePath: "",
      appliedMigrations: [],
      fromVersion: "0.0.0",
      toVersion: "0.9.0",
    });

    const resolved = resolveToolchainConfig(migrated);
    expect(resolved.features.nodePackageManager).toBe("disabled");
    expect(resolved.features.pythonToUv).toBe("disabled");
    expect(resolved.features.nonInteractiveGitRebase).toBe("mutate");
  });
});

describe("needs090Migration", () => {
  it("is true for v0 configs", () => {
    expect(needs090Migration({})).toBe(true);
  });

  it("is true when nixShell is missing", () => {
    expect(
      needs090Migration({
        version: "0.8.1-20260619",
        features: { nonInteractiveGitRebase: "mutate" },
      } as ToolchainConfig),
    ).toBe(true);
  });

  it("is false for fully migrated semver configs", () => {
    expect(
      needs090Migration({
        version: "0.10.1",
        features: {
          nodePackageManager: "disabled",
          pythonToUv: "disabled",
          nonInteractiveGitRebase: "mutate",
          nixShell: "disabled",
        },
      } as ToolchainConfig),
    ).toBe(false);
  });
});
