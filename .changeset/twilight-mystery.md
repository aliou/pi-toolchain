---
"@aliou/pi-toolchain": minor
---

Feature modes: rewriter features now support `"disabled"` | `"rewrite"` | `"block"` instead of booleans. In `"block"` mode the bash tool is not overridden — commands are blocked via tool_call hook instead. Config is auto-migrated on first load. `preventBrew` and `preventDockerSecrets` have been removed; use @aliou/pi-guardrails instead.
