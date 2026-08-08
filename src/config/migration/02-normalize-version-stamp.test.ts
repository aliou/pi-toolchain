import { describe, expect, it } from "vitest";
import type { ToolchainConfig } from "../types";
import {
  hasLegacyVersionStamp,
  migrateVersionStamp,
  normalizeVersionStampMigration,
} from "./02-normalize-version-stamp";

describe("normalize-version-stamp: hasLegacyVersionStamp", () => {
  it("detects legacy date-stamped versions", () => {
    expect(
      hasLegacyVersionStamp({ version: "0.8.1-20260619" } as ToolchainConfig),
    ).toBe(true);
    expect(
      hasLegacyVersionStamp({ version: "0.7.0-20260614" } as ToolchainConfig),
    ).toBe(true);
  });

  it("returns false for valid semver core strings", () => {
    expect(hasLegacyVersionStamp({ version: "0.9.0" } as ToolchainConfig)).toBe(
      false,
    );
    expect(
      hasLegacyVersionStamp({ version: "0.10.1" } as ToolchainConfig),
    ).toBe(false);
  });

  it("returns true for missing version", () => {
    expect(hasLegacyVersionStamp({})).toBe(true);
  });

  it("treats unknown non-semver strings as legacy", () => {
    expect(hasLegacyVersionStamp({ version: "abc" } as ToolchainConfig)).toBe(
      true,
    );
  });
});

describe("normalize-version-stamp: migrateVersionStamp", () => {
  it("stamps the current package version", () => {
    const migrated = migrateVersionStamp({});
    expect(migrated.version).toBe("0.10.1");
  });

  it("preserves other config keys", () => {
    const migrated = migrateVersionStamp({
      enabled: true,
      features: { nodePackageManager: "mutate" },
    } as ToolchainConfig);

    expect(migrated.enabled).toBe(true);
    expect(migrated.features?.nodePackageManager).toBe("mutate");
    expect(migrated.version).toBe("0.10.1");
  });
});

describe("normalize-version-stamp: migration object", () => {
  const dummyCtx = {
    filePath: "",
    appliedMigrations: [],
    fromVersion: "0.0.0",
    toVersion: "0.10.1",
  };

  it("runs on configs with legacy date-stamped versions", () => {
    expect(
      normalizeVersionStampMigration.shouldRun?.(
        {
          version: "0.8.1-20260619",
        } as ToolchainConfig,
        dummyCtx,
      ),
    ).toBe(true);
  });

  it("runs on configs without a version", () => {
    expect(normalizeVersionStampMigration.shouldRun?.({}, dummyCtx)).toBe(true);
  });

  it("does not run on normalized semver versions", () => {
    expect(
      normalizeVersionStampMigration.shouldRun?.(
        {
          version: "0.10.1",
        } as ToolchainConfig,
        dummyCtx,
      ),
    ).toBe(false);
  });

  it("stamps current package version", async () => {
    const migrated = await normalizeVersionStampMigration.run(
      { version: "0.8.1-20260619" } as ToolchainConfig,
      "",
      {
        filePath: "",
        appliedMigrations: [],
        fromVersion: "0.0.0",
        toVersion: "0.10.1",
      },
    );

    expect(migrated.version).toBe("0.10.1");
  });
});
