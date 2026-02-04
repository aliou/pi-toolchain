import { ConfigLoader } from "@aliou/pi-utils-settings";
import type { ResolvedToolchainConfig, ToolchainConfig } from "./config-schema";

const DEFAULT_CONFIG: ResolvedToolchainConfig = {
  enabled: true,
  features: {
    enforcePackageManager: false,
    rewritePython: false,
    preventBrew: false,
    gitRebaseEditor: true,
  },
  packageManager: {
    selected: "pnpm",
  },
};

export const configLoader = new ConfigLoader<
  ToolchainConfig,
  ResolvedToolchainConfig
>("toolchain", DEFAULT_CONFIG);
