# Export a storage snapshot

Retain a private, byte-exact migration snapshot of configured workflow state.

## Steps

1. Work in the target checkout. Set `CLI` to the installed absolute path of `skills/_shared/scripts/workflow-state-cli.ts`. Choose an output path outside Git and dotfile-manager source trees.
2. Export the complete project:
   ```sh
   bun "$CLI" migration-export '{"path":"/private/buck/snapshot.json","scope":"project"}'
   ```
   Use `scope: branch` or `scope: run` for the current trusted branch or workspace run. If the command refuses excluded receipt, checkpoint, or correction dependencies, export the project instead. Project scope is also required to retain rewrite mappings; branch scope does not include the publication-authority ledger.
3. **Eat:** stdout reports a snapshot digest and per-table record counts; the private file exists with mode `0600`. No payload or connection value appears on stdout.

Only retained revisions are exported. Unretained editable files are not discovered/reconciled by export. Do not pipe the private snapshot to chat or commit it. Continue with [import](import-storage-snapshot.md).
