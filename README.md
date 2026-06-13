![banner](https://assets.aliou.me/github/aliou/pi-toolchain/banner.png)

# Toolchain

Opinionated toolchain enforcement for pi. Transparently mutates commands to use preferred tools or blocks mismatched commands.

## Installation

```bash
pi install npm:@aliou/pi-toolchain
```

Or from git:

```bash
pi install git:github.com/aliou/pi-toolchain
```

## Features

Each feature is independently set to one of three modes:

- `"disabled"`: no action taken
- `"mutate"`: transparently mutate matching commands before shell execution
- `"block"`: block matching commands via tool_call hook

### packageManager

Mutates or blocks `npm`/`yarn`/`bun` commands to use the selected package manager. Also handles `npx` -> `pnpm dlx`/`bunx`.

### python

Mutates or blocks `python`/`python3` to `uv run python` and `pip`/`pip3` to `uv pip`.

### gitRebaseEditor

Injects `GIT_EDITOR=true` and `GIT_SEQUENCE_EDITOR=:` env vars for `git rebase` commands so they run non-interactively. Only supports `"disabled"` and `"mutate"` modes (block is not applicable).

## Settings Command

Run `/toolchain:settings` to open an interactive settings UI with two tabs:
- **Local**: edit project-scoped config (`.pi/extensions/toolchain.json`)
- **Global**: edit global config (`~/.pi/agent/extensions/toolchain.json`)

Use `Tab` / `Shift+Tab` to switch tabs. Feature modes and the package manager can be changed directly. Configure mutation notification visibility in JSON for now.

## Configuration

Configuration is loaded from two optional JSON files, merged in order (project overrides global):

- **Global**: `~/.pi/agent/extensions/toolchain.json`
- **Project**: `.pi/extensions/toolchain.json`

### Configuration Schema

```json
{
  "enabled": true,
  "features": {
    "packageManager": "disabled",
    "python": "disabled",
    "gitRebaseEditor": "mutate"
  },
  "packageManager": {
    "selected": "pnpm"
  },
  "ui": {
    "showMutationNotifications": false
  }
}
```

All fields are optional. Missing fields use the defaults shown above.

### Feature Defaults

| Feature | Default | Description |
|---|---|---|
| `packageManager` | `"disabled"` | Opt-in. Mutates or blocks package-manager commands. |
| `python` | `"disabled"` | Opt-in. Mutates or blocks python/pip commands to uv equivalents. |
| `gitRebaseEditor` | `"mutate"` | On by default. Injects non-interactive env vars for git rebase. |
| `ui.showMutationNotifications` | `false` | Show a Pi notification each time a mutation happens. |

### Examples

Enforce pnpm, mutate python commands, and show mutation notifications:

```json
{
  "features": {
    "packageManager": "mutate",
    "python": "mutate"
  },
  "packageManager": {
    "selected": "pnpm"
  },
  "ui": {
    "showMutationNotifications": true
  }
}
```

Block package-manager mismatches instead of mutating them:

```json
{
  "features": {
    "packageManager": "block"
  },
  "packageManager": {
    "selected": "pnpm"
  }
}
```

## How It Works

### Mutations vs Blockers

The extension uses pi's tool_call event hook:

1. **Blockers**: Commands that match a feature set to `"block"` are rejected with a reason. The agent sees the block reason and retries with the correct command.
2. **Mutations**: Commands that match a feature set to `"mutate"` are transparently rewritten before shell execution. The agent sees the original command in the tool call UI but gets the output of the mutated command.
3. **Mutation notifications**: When `ui.showMutationNotifications` is enabled, a warning-level Pi notification is shown for each mutation.

### AST-Based Rewriting

All rewriters use structural shell parsing via `@aliou/sh` to identify command names in the AST. This avoids false positives where tool names appear in URLs, file paths, or strings. If the parser fails, the command passes through unchanged -- a missed mutation is safe, a false positive mutation corrupts the command.

## Migration from Guardrails

If you were using `preventBrew`, `preventPython`, or `enforcePackageManager` in your guardrails config:

1. Install `@aliou/pi-toolchain`
2. Create `.pi/extensions/toolchain.json` with the equivalent config
3. Remove the deprecated features from your guardrails config

The guardrails extension will continue to honor these features with a deprecation warning until they are removed in a future version.
