import type { BashSourceMode } from "../config";

export function isValidBashSourceMode(value: unknown): value is BashSourceMode {
  return value === "override-bash" || value === "composed-bash";
}
