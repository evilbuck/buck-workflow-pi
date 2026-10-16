# Import a storage snapshot

Install a verified snapshot into an empty project destination, or resume its exact interrupted attempt.

## Steps

1. Set `CLI` to the installed absolute path of `skills/_shared/scripts/workflow-state-cli.ts`. Work in the target checkout. Point `BUCK_WORKFLOW_CONFIG` at a private configuration selecting the intended destination and the same explicit project identity. Stop destination writers.
2. Choose a private import journal and import:
   ```sh
   bun "$CLI" migration-import '{"file":"/private/buck/snapshot.json","path":"/private/buck/import.json"}'
   ```
   If interrupted, repeat exactly that command. The journal binds source digest, destination, and project; do not substitute a different snapshot.
3. **Eat:** the result reports `complete: true` and the source digest. Export the destination to a different private file and confirm the reported digest matches; an ordinary workflow read returns the expected current revision, not an arbitrary historical version.

An occupied/conflicting destination is refused, never merged or overwritten. A rollback rescue file uses this same command with an empty destination. This command does not change active backend configuration; use [switch](switch-storage-backend.md) for an existing active store. Original legacy JSON uses `migration-import-legacy` instead: an array of records with original `id` and `body` fields, optional `category`, `ranks`, `supersededBy`, and all other original metadata. Those records remain private without ordinary pointers or guessed branch/publication evidence; verify their original records in the next private snapshot, not ordinary retrieval.
