# Roll back a storage cutover

Restore the verified pre-cutover source while retaining every destination write in a private rescue snapshot.

## Steps

1. Stop all project writers. Set `CLI` to the installed absolute path of `skills/_shared/scripts/workflow-state-cli.ts`. Locate the original private switch journal; keep both stores and their connection environments available.
2. Roll back:
   ```sh
   bun "$CLI" migration-rollback '{"path":"/private/buck/switch.json","quiesced":true}'
   ```
3. Inspect the journal's `rescue.path` privately. Retain that snapshot and its `rescue.digest`; it includes destination history, pointers, and post-cutover correction ancestry. Neither source nor destination is deleted.
4. **Eat:** stdout reports `status: rolled-back` and a rescue digest; `doctor` reports the original backend; a known original artifact is readable. Resume source writers only now.

If the source changed since its pre-cutover snapshot, rollback refuses rather than overwriting it. Recover destination-only writes by [importing the rescue](import-storage-snapshot.md) into an empty project destination. Do not import the rescue over the restored nonempty source.
