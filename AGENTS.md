# pi-toolchain

Public Pi extension providing opinionated toolchain enforcement. Transparently rewrites commands to use preferred tools. People could be using this, so consider backwards compatibility when making changes.

Pi is pre-1.0.0, so breaking changes can happen between Pi versions. This extension must stay up to date with Pi or things will break.

## Stack

- TypeScript (strict mode)
- pnpm 10.26.1
- Biome for linting/formatting
- Changesets for versioning

## Scripts

```bash
pnpm typecheck    # Type check
pnpm lint         # Lint (runs on pre-commit)
pnpm format       # Format
pnpm changeset    # Create changeset for versioning
```

## Structure

```
src/
  index.ts          # Extension entry, registers hooks and tools
  config.ts         # Configuration loading and schema
  blockers/         # tool_call hooks that block commands
  rewriters/        # Spawn hook rewriters (transparent command rewriting)
  commands/         # Slash commands (settings UI)
  utils/            # Shell AST helpers
```

## Conventions

- New rewriters: follow patterns in `src/rewriters/`
- New blockers: follow patterns in `src/blockers/`
- All command matching uses AST parsing via `@aliou/sh`

## Versioning

Uses changesets. Run `pnpm changeset` before committing user-facing changes.

- `patch`: bug fixes
- `minor`: new features/tools
- `major`: breaking changes
