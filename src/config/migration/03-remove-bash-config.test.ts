import { describe, expect, it } from "vitest";
import type { ToolchainConfig } from "../types";
import {
  hasStaleBashConfig,
  migrateRemoveBashConfig,
  removeBashConfigMigration,
} from "./03-remove-bash-config";
import { CURRENT_VERSION } from "./version";

describe("remove-bash-config: hasStaleBashConfig detector", () => {
  it("detects stale bash key", () => {
    expect(
      hasStaleBashConfig({
        version: CURRENT_VERSION,
        bash: { sourceMode: "override-bash" },
      } as unknown as ToolchainConfig),
    ).toBe(true);
  });

  it("returns false for current schema", () => {
    expect(hasStaleBashConfig({ version: CURRENT_VERSION })).toBe(false);
  });
});

describe("remove-bash-config: migrateRemoveBashConfig", () => {
  it("strips stale bash key", () => {
    const migrated = migrateRemoveBashConfig({
      version: "0.6.0-20260612",
      bash: { sourceMode: "composed-bash" },
    } as unknown as ToolchainConfig);

    expect((migrated as Record<string, unknown>).bash).toBeUndefined();
    expect(migrated.version).toBe(CURRENT_VERSION);
  });
});

describe("remove-bash-config: migration object", () => {
  it("runs only when a stale bash key is present", () => {
    expect(
      removeBashConfigMigration.shouldRun({
        version: CURRENT_VERSION,
        bash: { sourceMode: "override-bash" },
      } as unknown as ToolchainConfig),
    ).toBe(true);
    expect(
      removeBashConfigMigration.shouldRun({
        version: CURRENT_VERSION,
      } as ToolchainConfig),
    ).toBe(false);
  });

  it("produces a user-facing message", () => {
    const msg = removeBashConfigMigration.message;
    expect(typeof msg).toBe("string");
    expect(msg).toContain("bash");
  });
});
