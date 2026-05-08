Add JSON Schema support for settings files.

## What to do

1. Update `@aliou/pi-utils-settings` to `^0.9.0` in dependencies.

2. Add `ts-json-schema-generator` as a devDep.

3. In `src/config.ts`:
   - Add JSDoc comments to every field on the `ToolchainConfig` interface (the user-facing one with optional fields). These become `description` in the generated schema.
   - Import `buildSchemaUrl` from `@aliou/pi-utils-settings`.
   - Import `package.json` with `import pkg from "../package.json" with { type: "json" }`.
   - Create `const schemaUrl = buildSchemaUrl(pkg.name, pkg.version)`.
   - Pass `schemaUrl` to the `ConfigLoader` constructor options.

4. Add scripts to `package.json`:
   ```json
   "gen:schema": "ts-json-schema-generator --path src/config.ts --type ToolchainConfig --no-type-check -o schema.json",
   "check:schema": "ts-json-schema-generator --path src/config.ts --type ToolchainConfig --no-type-check -o /tmp/schema-check.json && diff -q schema.json /tmp/schema-check.json"
   ```

5. Add `"schema.json"` to `files` in `package.json`.

6. Exclude `schema.json` from biome by adding `"!schema.json"` to `files.includes` in `biome.json`.

7. Run `pnpm gen:schema` to generate `schema.json`.

8. Add a `check:schema` step to `.github/workflows/ci.yml` after the typecheck step:
   ```yaml
   - name: Check schema is up to date
     run: pnpm check:schema
   ```

9. Verify: `pnpm lint && pnpm typecheck && pnpm check:schema` should all pass.

10. Commit everything, push to main.

## Reference

See the pi-utils-settings skill at `references/json-schema.md` for full details. The extension template at `../pi-extension-template/` is a working example.
