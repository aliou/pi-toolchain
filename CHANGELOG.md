# @aliou/pi-toolchain

## 0.9.0

### Minor Changes

- 11546d1: Add nix shell / devShell rewriting rule

### Patch Changes

- f0406b1: Update Pi devDependencies to 0.79.9. Widen peerDependency ranges for `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` from `>=0.74.0 <1` to `*` to match the canonical Pi package convention in docs/packages.md. No runtime behavior changes; no post-0.74 APIs are used.

## 0.8.1

### Patch Changes

- 28caeea: Fix migration of version-stamped boolean feature values to feature modes.

## 0.8.0

### Minor Changes

- 0aca4d0: Rewrite: tool_call-based command mutation, new config surface, removed bash integration

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

## 0.7.0

### Minor Changes

- e4b7f9e: Migrate Pi core package dependencies from `@mariozechner/*` to `@earendil-works/*` namespace.

  - `@mariozechner/pi-coding-agent` → `@earendil-works/pi-coding-agent` 0.74.0
  - `@aliou/pi-utils-settings` bumped to `^0.15.0`

## 0.6.2

### Patch Changes

- 67d33ce: Bump `@aliou/pi-utils-settings` to `0.13.0` to pick up the settings enum fix for `"disabled"` values.

## 0.6.1

### Patch Changes

- 3d606c3: Bump pi-utils-settings to 0.12.1 to fix crash in settings UI

## 0.6.0

### Minor Changes

- c1cc093: Add configurable `bash.sourceMode` with deterministic `override-bash` and `composed-bash` routing for rewrite features.

## 0.5.2

### Patch Changes

- c74fa7d: contribute bash spawn hook via composer request event while keeping standalone fallback
- d99e3b0: refactor internal extension hook registration structure for readability

## 0.5.1

### Patch Changes

- f8e54a4: update Pi deps to 0.61.0

## 0.5.0

### Minor Changes

- 520acf2: Add optional warning-level notifications for rewritten commands so demos and debugging make toolchain rewrites visible.

## 0.4.0

### Minor Changes

- 346fee2: Feature modes: rewriter features now support `"disabled"` | `"rewrite"` | `"block"` instead of booleans. In `"block"` mode the bash tool is not overridden — commands are blocked via tool_call hook instead. Config is auto-migrated on first load. `preventBrew` and `preventDockerSecrets` have been removed; use @aliou/pi-guardrails instead.

## 0.3.7

### Patch Changes

- 60f4ede: bump @aliou/pi-utils-settings to ^0.10.0 (local scope fix)

## 0.3.6

### Patch Changes

- cd484a8: Fix `prepare` script to only run husky from a git repository.

## 0.3.5

### Patch Changes

- 83f3b60: mark pi SDK peer deps as optional to prevent koffi OOM in Gondolin VMs

## 0.3.4

### Patch Changes

- b8a0e8b: Move to standalone repository

## 0.3.3

### Patch Changes

- Updated dependencies [7df01a2]
  - @aliou/pi-utils-settings@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [756552a]
  - @aliou/pi-utils-settings@0.3.0

## 0.3.1

### Patch Changes

- 2d9a958: update README documentation to match current implementation

## 0.3.0

### Minor Changes

- 523fe5e: Add a new `preventDockerSecrets` blocker feature to reduce accidental secret exfiltration from Docker containers.

  When enabled, toolchain blocks:

  - `docker inspect` (can expose `Config.Env`)
  - `docker exec ... env`
  - `docker exec ... printenv`
  - `docker exec ... cat /proc/<pid>/environ`

  The feature is opt-in and defaults to `false`.

## 0.2.1

### Patch Changes

- Add `preventDockerSecrets` blocker feature to block `docker inspect` and common `docker exec` env-exfiltration commands (`env`, `printenv`, `/proc/*/environ`).

## 0.2.0

### Minor Changes

- 7a3f659: Add memory scope for ephemeral settings overrides

## 0.1.2

### Patch Changes

- Updated dependencies [06e7e0c]
  - @aliou/pi-utils-settings@0.2.0

## 0.1.1

### Patch Changes

- 3471b6c: Explicitly add deps to root package.json
- d73dadb: Reorganize file structure: move commands to commands/, components to components/, utils to utils/. Merge config-schema types into config.ts.

## 0.1.0

### Minor Changes

- 29b61a5: Initial release: package manager rewriting, git rebase rewriting, python rewriting, and brew blocking via spawn hooks. Extracted from @aliou/pi-guardrails.
