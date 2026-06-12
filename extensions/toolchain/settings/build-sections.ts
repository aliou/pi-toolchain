import type { SettingsSection } from "@aliou/pi-utils-settings";
import type {
  BashSourceMode,
  FeatureMode,
  ResolvedToolchainConfig,
  ToolchainConfig,
} from "../../../src/config";

type FeatureKey = keyof ResolvedToolchainConfig["features"];

const FEATURE_UI: Record<
  FeatureKey,
  { label: string; description: string; modes: FeatureMode[] }
> = {
  enforcePackageManager: {
    label: "Enforce package manager",
    description:
      "Rewrite or block npm/yarn/bun commands to use the selected package manager",
    modes: ["disabled", "rewrite", "block"],
  },
  rewritePython: {
    label: "Python commands",
    description: "Rewrite or block python/pip commands to use uv equivalents",
    modes: ["disabled", "rewrite", "block"],
  },
  gitRebaseEditor: {
    label: "Git rebase editor",
    description:
      "Inject GIT_EDITOR and GIT_SEQUENCE_EDITOR for non-interactive rebase (rewrite only)",
    modes: ["disabled", "rewrite"],
  },
};

const PACKAGE_MANAGERS = ["pnpm", "bun", "npm"] as const;
const BASH_SOURCE_MODES: BashSourceMode[] = ["override-bash", "composed-bash"];

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
            "Package manager to use when enforcePackageManager is enabled",
          currentValue:
            tabConfig?.packageManager?.selected ??
            resolved.packageManager.selected,
          values: [...PACKAGE_MANAGERS],
        },
      ],
    },
    {
      label: "Bash Integration",
      items: [
        {
          id: "bash.sourceMode",
          label: "Source mode",
          description:
            "override-bash: toolchain registers bash when rewrite is active. composed-bash: toolchain contributes rewrite hook to external bash composer.",
          currentValue: tabConfig?.bash?.sourceMode ?? resolved.bash.sourceMode,
          values: [...BASH_SOURCE_MODES],
        },
      ],
    },
  ];
}
