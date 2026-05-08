import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { pendingWarnings } from "../utils/migration";

export function registerSessionStartWarnings(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    for (const warning of pendingWarnings.splice(0)) {
      ctx.ui.notify(warning, "warning");
    }
  });
}
