import { describe, expect, it } from "vitest";
import type { ToolchainConfig } from "../types";
import {
  migrateRenameKeys,
  needsKeyRename,
  renameKeysMigration,
} from "./02-rename-keys";
import { CURRENT_VERSION } from "./version";

describe("rename-keys: migrateRenameKeys", () => {
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

  it("stamps CURRENT_VERSION on migrated config", () => {
    const migrated = migrateRenameKeys({
      version: "0.5.2-20260331",
      features: {
        enforcePackageManager: "rewrite",
      } as unknown as ToolchainConfig["features"],
    });
    expect(migrated.version).toBe(CURRENT_VERSION);
  });
});

describe("rename-keys: needsKeyRename detector", () => {
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

describe("rename-keys: migration object", () => {
  it("runs only when keys or values are stale", () => {
    expect(
      renameKeysMigration.shouldRun({
        version: "0.5.2-20260331",
        features: {
          enforcePackageManager: "disabled",
        } as unknown as ToolchainConfig["features"],
      }),
    ).toBe(true);
    expect(
      renameKeysMigration.shouldRun({
        version: CURRENT_VERSION,
        features: { nodePackageManager: "mutate" },
      }),
    ).toBe(false);
  });

  it("produces a user-facing message", () => {
    const msg = renameKeysMigration.message;
    expect(typeof msg).toBe("string");
    expect(msg).toContain("mutate");
  });
});
