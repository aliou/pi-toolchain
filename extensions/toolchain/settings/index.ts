import { registerSettingsCommand } from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type {
  ResolvedToolchainConfig,
  ToolchainConfig,
} from "../../../src/config";
import { configLoader } from "../../../src/config";
import { buildToolchainSettingsSections } from "./build-sections";

export function registerToolchainSettings(pi: ExtensionAPI): void {
  registerSettingsCommand<ToolchainConfig, ResolvedToolchainConfig>(pi, {
    commandName: "toolchain:settings",
    title: "Toolchain Settings",
    configStore: configLoader,
    buildSections: buildToolchainSettingsSections,
  });
}
