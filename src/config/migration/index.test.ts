import { describe, expect, it } from "vitest";
import { resolveToolchainConfig, type ToolchainConfig } from "../../config";
import {
  hasLegacyVersionStamp,
  normalizeVersionStampMigration,
} from "./02-normalize-version-stamp";
import { migrations, v090Migration } from "./index";

describe("migration chain", () => {
  it("registers exactly the expected migrations in order", () => {
    expect(migrations.map((m) => m.name)).toEqual([
      "v0-9-0",
      "normalize-version-stamp",
    ]);
    expect(migrations[0]?.version).toBe("0.9.0");
    expect(migrations[1]?.version).toBe("0.10.1");
  });

  it("resolves v0 config through both migrations", async () => {
    const config: ToolchainConfig = {
      enabled: true,
      features: {
        enforcePackageManager: true,
      } as unknown as ToolchainConfig["features"],
    };

    const after090 = await v090Migration.run(config, "", {
      filePath: "",
      appliedMigrations: [],
      fromVersion: "0.0.0",
      toVersion: "0.9.0",
    });
    expect(hasLegacyVersionStamp(after090)).toBe(true);

    const migrated = await normalizeVersionStampMigration.run(after090, "", {
      filePath: "",
      appliedMigrations: ["v0-9-0"],
      fromVersion: "0.9.0",
      toVersion: "0.10.1",
    });
    expect(migrated.version).toBe("0.10.1");

    const resolved = resolveToolchainConfig(migrated);
    expect(resolved.features.nodePackageManager).toBe("mutate");
    expect(resolved.features.nixShell).toBe("disabled");
  });
});
