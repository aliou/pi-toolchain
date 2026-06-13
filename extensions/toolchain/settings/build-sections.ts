import type { SettingsSection } from "@aliou/pi-utils-settings";
import type {
  FeatureMode,
  ResolvedToolchainConfig,
  ToolchainConfig,
} from "../../../src/config";

type FeatureKey = keyof ResolvedToolchainConfig["features"];

const FEATURE_UI: Record<
  FeatureKey,
  { label: string; description: string; modes: FeatureMode[] }
> = {
  packageManager: {
    label: "Package manager enforcement",
    description:
      "Mutate or block npm/yarn/bun commands to use the selected package manager",
    modes: ["disabled", "mutate", "block"],
  },
  python: {
    label: "Python commands",
    description: "Mutate or block python/pip commands to use uv equivalents",
    modes: ["disabled", "mutate", "block"],
  },
  gitRebaseEditor: {
    label: "Git rebase editor",
    description:
      "Inject GIT_EDITOR and GIT_SEQUENCE_EDITOR for non-interactive rebase (mutate only)",
    modes: ["disabled", "mutate"],
  },
};

const PACKAGE_MANAGERS = ["pnpm", "bun", "npm"] as const;

export function buildToolchainSettingsSections(
  tabConfig: ToolchainConfig | null,
  resolved: ResolvedToolchainConfig,
): SettingsSection[] {
  const featureItems = (Object.keys(FEATURE_UI) as FeatureKey[]).map((key) => ({
    id: `features.${key}`,
    label: FEATURE_UI[key].label,
    description: FEATURE_UI[key].description,
    currentValue: tabConfig?.features?.[key] ?? resolved.features[key],
    values: FEATURE_UI[key].modes,
  }));

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
            "Package manager to use when packageManager feature is enabled",
          currentValue:
            tabConfig?.packageManager?.selected ??
            resolved.packageManager.selected,
          values: [...PACKAGE_MANAGERS],
        },
      ],
    },
  ];
}
