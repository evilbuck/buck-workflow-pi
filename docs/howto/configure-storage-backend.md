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
   - `postgres` requires `connection_env` to name an environment variable containing the connection URL; never put the URL itself in YAML.

   The project-level `storage` selection replaces the machine-level selection. Omit project `storage` to inherit the machine default. Do not add branch-specific backend overrides.

3. Optional: set `integration_ref` to the full local Git ref, such as `refs/remotes/origin/master`, only when automatic checkpoint publication is intended. Without it, no checkpoint is automatically published. Rewritten history requires an explicit verified mapping; see [publication procedures](enable-checkpoint-publication.md).

4. From the project checkout, inspect the resolved selection:

   ```sh
   bun skills/_shared/scripts/workflow-state-cli.ts doctor
   ```

5. **Eat:** `doctor` reports the expected adapter and project key without printing credentials or artifact payloads. If the file is missing, unreadable, malformed, or ambiguous, fix the config; an explicitly selected file never silently falls back to repository storage.

Keep database files, WAL/SHM files, manifests, exports, journals, and receipts out of Git and dotfile-manager source trees. Only the text configuration belongs in config-only dotfile management. See [SQL memory and durable storage](../sql-memory.md#durable-backend-migration) for backup, privacy, and recovery boundaries.
