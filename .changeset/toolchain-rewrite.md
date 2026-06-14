---
"@aliou/pi-toolchain": minor
---

Rewrite: tool_call-based command mutation, new config surface, removed bash integration

**Breaking config changes (migrations provided):**
- `FeatureMode` `"rewrite"` renamed to `"mutate"`
- `features.enforcePackageManager` renamed to `features.packageManager`
- `features.rewritePython` renamed to `features.python`
- `ui.showRewriteNotifications` renamed to `ui.showMutationNotifications`
- `bash.sourceMode` and `BashSourceMode` removed entirely
- Config migrations automatically handle all renames and strip stale keys

**New features:**
- Command mutation via `tool_call` hook — `event.input.command` is mutated in place before shell execution, replacing the spawn-hook/bash-integration approach
- All three behaviors (block, mutate, notify) handled by a single `tool_call` handler
- Execution order: blockers first, then mutation, then notifications

**Removed:**
- `bash-integration.ts` and `bash-composition.ts` deleted
- `createBashTool` / `BashSpawnContext` / spawn hook registration removed
- `override-bash` and `composed-bash` source modes removed
- Mutation notifications no longer have `[override-bash]`/`[composed-bash]` prefix

**Architecture:**
- `src/` — pure functions, zero Pi runtime imports
- `extensions/toolchain/` — Pi extension entry point, hooks, settings UI
- 40 tests covering config defaults, migrations, feature predicates, tool_call hook, and pure mutation engine
