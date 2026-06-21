import { describe, expect, it } from "vitest";
import type { ToolchainConfig } from "../types";
import {
  isV0,
  migrateV0,
  v0Message,
  v0ToCurrentMigration,
} from "./01-v0-to-current";
import { CURRENT_VERSION } from "./version";

describe("v0-to-current: isV0 detector", () => {
  it("returns true for config without a version field", () => {
    expect(isV0({ enabled: true } as ToolchainConfig)).toBe(true);
  });

  it("returns false once a version is stamped", () => {
    expect(isV0({ version: CURRENT_VERSION } as ToolchainConfig)).toBe(false);
  });
});

describe("v0-to-current: migrateV0", () => {
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

  it("stamps CURRENT_VERSION on migrated config", () => {
    const migrated = migrateV0({ enabled: true } as ToolchainConfig);
    expect(migrated.version).toBe(CURRENT_VERSION);
  });
});

describe("v0-to-current: v0Message", () => {
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

describe("v0-to-current: migration object", () => {
  it("runs only on v0 configs", () => {
    expect(
      v0ToCurrentMigration.shouldRun({ enabled: true } as ToolchainConfig),
    ).toBe(true);
    expect(
      v0ToCurrentMigration.shouldRun({
        version: CURRENT_VERSION,
      } as ToolchainConfig),
    ).toBe(false);
  });

  it("produces a user-facing message", () => {
    const { message } = v0ToCurrentMigration;
    expect(typeof message).toBe("function");
    if (typeof message !== "function") return;
    const msg = message(
      { enabled: true } as ToolchainConfig,
      { enabled: true } as ToolchainConfig,
      "~/path/to/config.json",
    );
    expect(typeof msg).toBe("string");
    expect(msg).toContain("/toolchain:settings");
  });
});
