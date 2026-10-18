# Quarantine legacy memory

Retain original legacy JSON without guessing branch identity or publication proof.

## Steps

1. Obtain a read-only export of the legacy records as a JSON array, including available IDs, categories, ranks, correction links, and provenance. Keep the original source unchanged.
2. Set `CLI` to the installed absolute path of `skills/_shared/scripts/workflow-state-cli.ts`. Choose a private recovery directory outside Git and dotfile-manager source trees.
3. Retain the original records:
   ```sh
   bun "$CLI" migration-quarantine '{"file":"/private/buck/legacy.json","path":"/private/buck/recovery"}'
   ```
4. **Eat:** stdout reports `recoveryScope`, count, and digest; `recoveryScope/manifest.json` under the private directory contains the original records. Ordinary workflow retrieval contains none of them.

Repeating the exact input selects the same content-addressed recovery scope. This operation never adopts `SQL_MEMORY_URL`, changes config, deletes source data, or makes a Hindsight publication claim. To retain compatible memory records inside an empty adapter, see the legacy option in [import](import-storage-snapshot.md).
