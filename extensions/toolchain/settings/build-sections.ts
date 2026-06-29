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
  nodePackageManager: {
    label: "Node package manager",
    description:
      "Mutate or block npm/yarn/bun commands to use the selected package manager",
    modes: ["disabled", "mutate", "block"],
  },
  pythonToPython3: {
    label: "Python to python3",
    description: "Mutate or block bare python commands to use python3",
    modes: ["disabled", "mutate", "block"],
  },
  pythonToUv: {
    label: "Python to uv",
    description: "Mutate or block python/pip commands to use uv equivalents",
    modes: ["disabled", "mutate", "block"],
  },
  nonInteractiveGitRebase: {
    label: "Non-interactive git rebase",
    description:
      "Inject GIT_EDITOR and GIT_SEQUENCE_EDITOR for non-interactive rebase (mutate only)",
    modes: ["disabled", "mutate"],
  },
  nixShell: {
    label: "Nix shell / devShell",
    description:
      "Wrap commands in nix-shell or nix develop when shell.nix / flake.nix is detected (mutate only)",
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
      label: "Node Package Manager",
      items: [
        {
          id: "nodePackageManager.selected",
          label: "Selected manager",
          description:
            "Package manager to use when nodePackageManager feature is enabled",
          currentValue:
            tabConfig?.nodePackageManager?.selected ??
            resolved.nodePackageManager.selected,
          values: [...PACKAGE_MANAGERS],
        },
      ],
    },
  ];
}
