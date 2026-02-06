# Toolchain

Opinionated toolchain enforcement for pi. Transparently rewrites commands to use preferred tools instead of blocking and forcing retries.

## Installation

Install via the pi-extensions package:

```bash
pi install git:github.com/aliou/pi-extensions
```

Or selectively in your `settings.json`:

```json
{
  "packages": [
    {
      "source": "git:github.com/aliou/pi-extensions",
      "extensions": ["extensions/toolchain"]
    }
  ]
}
```

Or from npm:

```bash
pi install npm:@aliou/pi-toolchain
```

## Features

### Rewriters (transparent, via spawn hook)

These features rewrite commands before shell execution. The agent never sees that the command was changed.

- **enforcePackageManager**: Rewrites `npm`/`yarn`/`bun` commands to the selected package manager. Also handles `npx` -> `pnpm dlx`/`bunx`.
- **rewritePython**: Rewrites `python`/`python3` to `uv run python` and `pip`/`pip3` to `uv pip`.
- **gitRebaseEditor**: Injects `GIT_EDITOR=true` and `GIT_SEQUENCE_EDITOR=:` env vars for `git rebase` commands so they run non-interactively.

### Blockers (via tool_call hooks)

These features block commands that have no clear rewrite target.

- **preventBrew**: Blocks all `brew` commands. Homebrew has no reliable 1:1 mapping to Nix.
- **preventDockerSecrets**: Blocks `docker inspect` and common `docker exec` env-exfiltration commands (`env`, `printenv`, `/proc/*/environ`).
- **python confirm** (part of rewritePython): When python/pip is used outside a uv project (no `pyproject.toml`), shows a confirmation dialog. Also blocks `poetry`/`pyenv`/`virtualenv` unconditionally.

## Configuration

Configuration is loaded from two optional JSON files, merged in order (project overrides global):

- **Global**: `~/.pi/agent/extensions/toolchain.json`
- **Project**: `.pi/extensions/toolchain.json`

### Configuration Schema

```json
{
  "enabled": true,
  "features": {
    "enforcePackageManager": false,
    "rewritePython": false,
    "preventBrew": false,
    "preventDockerSecrets": false,
    "gitRebaseEditor": true
  },
  "packageManager": {
    "selected": "pnpm"
  }
}
```

All fields are optional. Missing fields use the defaults shown above.

### Feature Defaults

| Feature | Default | Description |
|---|---|---|
| `enforcePackageManager` | `false` | Opt-in. User must pick a manager. |
| `rewritePython` | `false` | Opt-in. User must have uv set up. |
| `preventBrew` | `false` | Opt-in. Machine-specific. |
| `preventDockerSecrets` | `false` | Opt-in. Blocks commands that can exfiltrate container env secrets. |
| `gitRebaseEditor` | `true` | On by default. Always safe. |

### Examples

Enforce pnpm and block brew:

```json
{
  "features": {
    "enforcePackageManager": true,
    "preventBrew": true
  },
  "packageManager": {
    "selected": "pnpm"
  }
}
```

Enable python/uv rewriting:

```json
{
  "features": {
    "rewritePython": true
  }
}
```

## How It Works

### Rewriters vs Blockers

The extension uses two pi mechanisms:

1. **Spawn hook** (`createBashTool` with `spawnHook`): Rewrites commands before shell execution. The agent sees the output of the rewritten command but doesn't know it was changed. Used for package manager, python/uv, and git rebase.

2. **tool_call event hooks**: Block commands entirely. The agent sees a block reason and retries with the correct command. Used for brew (no rewrite target) and python outside uv projects (needs confirmation).

### Execution Order

1. Guardrails `tool_call` hooks run first (permission gate, env protection)
2. Toolchain `tool_call` hooks run (brew blocker, python confirm)
3. If not blocked, toolchain's bash tool runs with spawn hook (rewrites command)
4. Shell executes the rewritten command

### AST-Based Rewriting

All rewriters use structural shell parsing via `@aliou/sh` to identify command names in the AST. This avoids false positives where tool names appear in URLs, file paths, or strings. If the parser fails, the command passes through unchanged -- a missed rewrite is safe, a false positive rewrite corrupts the command.

## Migration from Guardrails

If you were using `preventBrew`, `preventPython`, or `enforcePackageManager` in your guardrails config:

1. Install `@aliou/pi-toolchain`
2. Create `.pi/extensions/toolchain.json` with the equivalent config
3. Remove the deprecated features from your guardrails config

The guardrails extension will continue to honor these features with a deprecation warning until they are removed in a future version.
