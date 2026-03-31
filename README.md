# Toolchain

Opinionated toolchain enforcement for pi. Transparently rewrites commands to use preferred tools instead of blocking and forcing retries.

## Installation

```bash
pi install npm:@aliou/pi-toolchain
```

Or from git:

```bash
pi install git:github.com/aliou/pi-toolchain
```

## Features

### Rewriters (transparent, via spawn hook)

These features rewrite commands before shell execution. By default the agent does not see that the command was changed, but you can enable optional rewrite notifications in the config.

- **enforcePackageManager**: Rewrites `npm`/`yarn`/`bun` commands to the selected package manager. Also handles `npx` -> `pnpm dlx`/`bunx`.
- **rewritePython**: Rewrites `python`/`python3` to `uv run python` and `pip`/`pip3` to `uv pip`.
- **gitRebaseEditor**: Injects `GIT_EDITOR=true` and `GIT_SEQUENCE_EDITOR=:` env vars for `git rebase` commands so they run non-interactively.

### Blockers (via tool_call hooks)

These features block commands that have no clear rewrite target.

- **preventBrew**: Blocks all `brew` commands. Homebrew has no reliable 1:1 mapping to Nix.
- **preventDockerSecrets**: Blocks `docker inspect` and common `docker exec` env-exfiltration commands (`env`, `printenv`, `/proc/*/environ`).
- **python confirm** (part of rewritePython): When python/pip is used outside a uv project (no `pyproject.toml`), shows a confirmation dialog. Also blocks `poetry`/`pyenv`/`virtualenv` unconditionally.

## Settings Command

Run `/toolchain:settings` to open an interactive settings UI with two tabs:
- **Local**: edit project-scoped config (`.pi/extensions/toolchain.json`)
- **Global**: edit global config (`~/.pi/agent/extensions/toolchain.json`)

Use `Tab` / `Shift+Tab` to switch tabs. Feature modes, the package manager, and bash source mode can be changed directly. Configure rewrite notification visibility in JSON for now.

## Configuration

Configuration is loaded from two optional JSON files, merged in order (project overrides global):

- **Global**: `~/.pi/agent/extensions/toolchain.json`
- **Project**: `.pi/extensions/toolchain.json`

### Configuration Schema

```json
{
  "enabled": true,
  "features": {
    "enforcePackageManager": "disabled",
    "rewritePython": "disabled",
    "gitRebaseEditor": "rewrite"
  },
  "packageManager": {
    "selected": "pnpm"
  },
  "bash": {
    "sourceMode": "override-bash"
  },
  "ui": {
    "showRewriteNotifications": false
  }
}
```

All fields are optional. Missing fields use the defaults shown above.

### Feature Defaults

| Feature | Default | Description |
|---|---|---|
| `enforcePackageManager` | `"disabled"` | Opt-in. Rewrites or blocks package-manager commands. |
| `rewritePython` | `"disabled"` | Opt-in. Rewrites or blocks python/pip commands to uv equivalents. |
| `gitRebaseEditor` | `"rewrite"` | On by default. Injects non-interactive env vars for git rebase. |
| `bash.sourceMode` | `"override-bash"` | Select how rewrite hooks reach bash at runtime. Only matters when at least one feature is set to `"rewrite"`. |
| `ui.showRewriteNotifications` | `false` | Show a visible Pi notification each time a rewrite happens. |

### Examples

Enforce pnpm, rewrite python commands, use explicit override mode, and show rewrite notifications:

```json
{
  "features": {
    "enforcePackageManager": "rewrite",
    "rewritePython": "rewrite"
  },
  "packageManager": {
    "selected": "pnpm"
  },
  "bash": {
    "sourceMode": "override-bash"
  },
  "ui": {
    "showRewriteNotifications": true
  }
}
```

Use composed bash integration with an external bash composer:

```json
{
  "features": {
    "enforcePackageManager": "rewrite"
  },
  "packageManager": {
    "selected": "pnpm"
  },
  "bash": {
    "sourceMode": "composed-bash"
  }
}
```

Block package-manager mismatches instead of rewriting them:

```json
{
  "features": {
    "enforcePackageManager": "block"
  },
  "packageManager": {
    "selected": "pnpm"
  }
}
```

## How It Works

### Rewriters vs Blockers

The extension uses two pi mechanisms:

1. **Spawn hook** (`createBashTool` with `spawnHook`): Rewrites commands before shell execution. The agent sees the original command in the tool call UI but gets the output of the rewritten command.
2. **tool_call event hooks**: Block commands entirely. The agent sees a block reason and retries with the correct command. Used for commands that have no safe rewrite target.
3. **Optional rewrite notifications**: When `ui.showRewriteNotifications` is enabled, a warning-level Pi notification is shown before the rewritten command runs. The message is prefixed with `[override-bash]` or `[composed-bash]` for debug clarity.

### Execution Order

1. Guardrails `tool_call` hooks run first (permission gate, env protection)
2. Toolchain `tool_call` hooks run (blockers, optional rewrite notifications)
3. If not blocked and at least one feature is in `rewrite` mode, runtime routing depends on `bash.sourceMode`:
   - `override-bash`: toolchain registers its own bash tool with spawn hook
   - `composed-bash`: toolchain waits for an external composer to request and compose its spawn hook
4. Shell executes the rewritten command

### AST-Based Rewriting

All rewriters use structural shell parsing via `@aliou/sh` to identify command names in the AST. This avoids false positives where tool names appear in URLs, file paths, or strings. If the parser fails, the command passes through unchanged -- a missed rewrite is safe, a false positive rewrite corrupts the command.

## Bash Source Mode

`bash.sourceMode` controls how rewrite hooks attach to bash at runtime.

- `override-bash` (default): toolchain registers bash when rewrite is active.
- `composed-bash`: toolchain contributes its rewrite hook to an external bash composer.

Important:
- Source mode matters only when at least one feature is set to `"rewrite"`.
- Features set to `"block"` are unaffected.
- In `override-bash` mode, Pi core still uses first-wins tool registration. If another extension earlier in load order already registered `bash`, toolchain cannot replace it.
- In `composed-bash` mode, rewrites run only if an external composer emits `ad:bash:spawn-hook:request` and collects contributors.
- If no composer exists, rewrites will not run in `composed-bash` mode by design.

## Migration from Guardrails

If you were using `preventBrew`, `preventPython`, or `enforcePackageManager` in your guardrails config:

1. Install `@aliou/pi-toolchain`
2. Create `.pi/extensions/toolchain.json` with the equivalent config
3. Remove the deprecated features from your guardrails config

The guardrails extension will continue to honor these features with a deprecation warning until they are removed in a future version.
