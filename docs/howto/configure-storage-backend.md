# Configure a storage backend

Choose the authoritative durable storage for a project. Each project resolves to exactly one backend; changing an existing project's backend requires the verified [cutover procedure](switch-storage-backend.md).

## Steps

1. Create the machine config at `${XDG_CONFIG_HOME:-~/.config}/buck-workflow/config.yaml`, or set `BUCK_WORKFLOW_CONFIG` to an alternate config file. Use the project's exact Git origin in `origins`:

   ```yaml
   version: 1
   storage:
     adapter: repo-files
   projects:
     my-project:
       origins:
         - git@github.com:example/project.git
       storage:
         adapter: sqlite
         database: /home/me/.config/buck-workflow/project.sqlite
   ```

2. Choose one `adapter` for the project:
   - `repo-files` keeps editable narrative bodies in the checkout's `.context/` and is the no-config default.
   - `external-files` keeps project data outside the checkout. Optionally set `root`; otherwise it uses `${XDG_CONFIG_HOME:-~/.config}/buck-workflow/{project}/.context`.
   - `sqlite` uses a machine-local database. Optionally set `database`; otherwise it uses `${XDG_CONFIG_HOME:-~/.config}/buck-workflow/state.sqlite`.
   - `postgres` requires PostgreSQL 18 with pgvector installed on the server: the immutable bootstrap migration uses `uuidv7()` and `CREATE EXTENSION vector`. Set `connection_env` to name an environment variable containing the connection URL; never put the URL itself in YAML. A plain PostgreSQL container without these prerequisites is not a usable backend.

   The project-level `storage` selection replaces the machine-level selection. Omit project `storage` to inherit the machine default. Do not add branch-specific backend overrides.

3. Optional: set `integration_ref` to the full local Git ref, such as `refs/remotes/origin/master`, only when automatic checkpoint publication is intended. Without it, no checkpoint is automatically published. Rewritten history requires an explicit verified mapping; see [publication procedures](enable-checkpoint-publication.md).

4. From the project checkout, inspect the resolved selection:

   ```sh
   bun skills/_shared/scripts/workflow-state-cli.ts doctor
   ```

5. Verify OMP loads the same Buck implementation as the CLI. Its configured package path does not change when you enter another checkout. For a process-local integration check, start a fresh OMP process with `--no-extensions -e /absolute/path/to/buck-workflow/extensions/index.ts` and the same `BUCK_WORKFLOW_CONFIG`. Use native `workflow_state` to read an existing artifact, then compare its revision and hash with the CLI. Do not relink the global installation or adopt an old local completion flag to make the check pass.

6. **Eat:** `doctor` reports the expected adapter and whether a project override matched, without printing credentials or artifact payloads, and native/CLI readback agrees on the exact artifact revision and hash. If the file is missing, unreadable, malformed, or ambiguous, fix the config; an explicitly selected file never silently falls back to repository storage.

Keep database files, WAL/SHM files, manifests, exports, journals, and receipts out of Git and dotfile-manager source trees. Only the text configuration belongs in config-only dotfile management. See [SQL memory and durable storage](../sql-memory.md#durable-backend-migration) for backup, privacy, and recovery boundaries.
