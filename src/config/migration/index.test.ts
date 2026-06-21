import { describe, expect, it } from "vitest";
import { resolveToolchainConfig, type ToolchainConfig } from "../../config";
import { migrateRenameKeys, migrateV0, needsKeyRename } from "./index";

describe("migration chain", () => {
  it("resolves v0 config through full migration chain", () => {
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
