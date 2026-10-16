# Switch storage backend

Move a project's retained workflow state to an empty destination without deleting the source.

## Steps

1. Work in the target checkout. Ensure its machine config has an explicit project entry with safe origin aliases. Set `CLI` to the installed absolute path of `skills/_shared/scripts/workflow-state-cli.ts`.
2. Stop every project writer, including agents in sibling worktrees. Keep them stopped until the switch is verified. Retain any editable changes through the current adapter before exporting.
3. Diagnose selection: `bun "$CLI" doctor`. A reported legacy env does not select PostgreSQL.
4. Choose a private journal path outside Git and dotfile-manager source trees. Preview a SQLite destination, replacing these example absolute paths:
   ```sh
   bun "$CLI" migration-dry-run '{"path":"/private/buck/switch.json","destination":{"adapter":"sqlite","database":"/private/buck/state.sqlite"}}'
   ```
   Inspect the full `before`/`after` row-digest inventories and both directional differences. A nonempty/conflicting destination will be refused, not overwritten.
5. Switch with the same destination during the maintenance window:
   ```sh
   bun "$CLI" migration-cutover '{"path":"/private/buck/switch.json","destination":{"adapter":"sqlite","database":"/private/buck/state.sqlite"},"quiesced":true}'
   ```
6. **Eat:** the result reports `status: switched`; `bun "$CLI" doctor` reports `adapter: sqlite`; an ordinary workflow read returns a known retained artifact. Restart writers only now.

For PostgreSQL use `{"adapter":"postgres","connection_env":"BUCK_WORKFLOW_DATABASE_URL"}`; put its credential value only in that environment variable. If the switch journal exists, resume it; do not start another cutover on that path. Resume is not available until that journal is written. Preserve the journal and unchanged source for [rollback](rollback-storage-cutover.md).
