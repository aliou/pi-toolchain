import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  resolveToolchainConfig,
  type ToolchainConfig,
} from "./index";

describe("config defaults", () => {
  it("defaults nonInteractiveGitRebase to mutate", () => {
    const resolved = resolveToolchainConfig({});
    expect(resolved.features.nonInteractiveGitRebase).toBe("mutate");
  });

  it("defaults nodePackageManager and pythonToUv to disabled", () => {
    const resolved = resolveToolchainConfig({});
    expect(resolved.features.nodePackageManager).toBe("disabled");
    expect(resolved.features.pythonToUv).toBe("disabled");
  });

  it("DEFAULT_CONFIG has mutation surface", () => {
    expect(DEFAULT_CONFIG.features.nodePackageManager).toBe("disabled");
    expect(DEFAULT_CONFIG.features.pythonToUv).toBe("disabled");
    expect(DEFAULT_CONFIG.features.nonInteractiveGitRebase).toBe("mutate");
    expect(DEFAULT_CONFIG.ui.showMutationNotifications).toBe(false);
    expect("bash" in DEFAULT_CONFIG).toBe(false);
  });

  it("rejects nonInteractiveGitRebase block mode", () => {
    expect(() =>
      resolveToolchainConfig({
        features: { nonInteractiveGitRebase: "block" },
      }),
    ).toThrow(/nonInteractiveGitRebase must be "disabled" or "mutate"/);
  });

  it("strips stale bash key from old configs", () => {
    const resolved = resolveToolchainConfig({
      bash: { sourceMode: "override-bash" },
    } as unknown as ToolchainConfig);

    expect(
      (resolved as unknown as Record<string, unknown>).bash,
    ).toBeUndefined();
  });

  it("strips stale feature keys from old configs", () => {
    const resolved = resolveToolchainConfig({
      features: {
        packageManager: "mutate",
        python: "mutate",
        gitRebaseEditor: "mutate",
      },
    } as unknown as ToolchainConfig);

    const features = resolved.features as unknown as Record<string, unknown>;
    expect(features.packageManager).toBeUndefined();
    expect(features.python).toBeUndefined();
    expect(features.gitRebaseEditor).toBeUndefined();
  });

  it("strips stale top-level packageManager key", () => {
    const resolved = resolveToolchainConfig({
      packageManager: { selected: "pnpm" },
    } as unknown as ToolchainConfig);

    expect(
      (resolved as unknown as Record<string, unknown>).packageManager,
    ).toBeUndefined();
  });
});
