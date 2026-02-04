import {
  registerSettingsCommand,
  type SettingsSection,
} from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { configLoader } from "./config";
import type { ResolvedToolchainConfig, ToolchainConfig } from "./config-schema";

type FeatureKey = keyof ResolvedToolchainConfig["features"];

const FEATURE_UI: Record<FeatureKey, { label: string; description: string }> = {
  enforcePackageManager: {
    label: "Enforce package manager",
    description:
      "Rewrite npm/yarn/bun commands to the selected package manager",
  },
  rewritePython: {
    label: "Rewrite Python commands",
    description: "Prepend 'uv run' to python/python3, rewrite pip to 'uv pip'",
  },
  preventBrew: {
    label: "Block Homebrew",
    description:
      "Block brew install/upgrade commands (use Nix or system packages)",
  },
  gitRebaseEditor: {
    label: "Git rebase editor",
    description:
      "Inject GIT_EDITOR and GIT_SEQUENCE_EDITOR for non-interactive rebase",
  },
};

const PACKAGE_MANAGERS = ["pnpm", "bun", "npm"] as const;

export function registerToolchainSettings(pi: ExtensionAPI): void {
  registerSettingsCommand<ToolchainConfig, ResolvedToolchainConfig>(pi, {
    commandName: "toolchain:settings",
    title: "Toolchain Settings",
    configStore: configLoader,
    buildSections: (
      tabConfig: ToolchainConfig | null,
      resolved: ResolvedToolchainConfig,
      _ctx,
    ): SettingsSection[] => {
      const featureItems = (Object.keys(FEATURE_UI) as FeatureKey[]).map(
        (key) => ({
          id: `features.${key}`,
          label: FEATURE_UI[key].label,
          description: FEATURE_UI[key].description,
          currentValue:
            (tabConfig?.features?.[key] ?? resolved.features[key])
              ? "enabled"
              : "disabled",
          values: ["enabled", "disabled"],
        }),
      );

      return [
        {
          label: "Features",
          items: featureItems,
        },
        {
          label: "Package Manager",
          items: [
            {
              id: "packageManager.selected",
              label: "Selected manager",
              description:
                "Package manager to enforce when 'Enforce package manager' is enabled",
              currentValue:
                tabConfig?.packageManager?.selected ??
                resolved.packageManager.selected,
              values: [...PACKAGE_MANAGERS],
            },
          ],
        },
      ];
    },
  });
}
