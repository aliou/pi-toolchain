---
"@aliou/pi-toolchain": patch
---

feat(config): adopt pi-utils-settings 0.19.1 versioned migrations

Bumped `@aliou/pi-utils-settings` to `^0.19.1`. Legacy migrations have been
composed into a single semver versioned migration for the 0.9.0 release, and a
new terminal migration normalizes legacy date-stamped version strings (e.g.
`"0.8.1-20260619"`) to the package semver (`"0.10.1"`). Added JSON Schema
generation and `schemaUrl` wiring via `buildSchemaUrl`.
