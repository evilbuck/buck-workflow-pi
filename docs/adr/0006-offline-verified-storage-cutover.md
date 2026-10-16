---
status: accepted
---

# Backend cutover is an offline verified switch

Moving a project between adapters copies one version-1 migration snapshot into an empty destination, then atomically replaces that project's config and rebinds matching consumers. Writers across every worktree stay stopped. The source is not deleted. `SQL_MEMORY_URL` is diagnosed and never adopted as the backend. Legacy records without exact branch or publication evidence stay in a private quarantine; a branch name is not proof. Payloads stay in private files; stdout carries counts and digests only.

## Considered Options

- Online dual-write: rejected. A crash would publish a partial inventory or leave the two stores diverged.
- Adopt `SQL_MEMORY_URL` as PostgreSQL selection: rejected. That variable remains the loop save-mode gate.
- Guess publication for legacy imports: rejected. Ambiguous provenance would enter ordinary retrieval.
- Delete the source after switch: rejected. Rollback needs the verified pre-cutover snapshot, and post-cutover writes are rescued first.

## Consequences

- Cutover, resume, and rollback require `quiesced: true`. Neither store is deleted.
- Import refuses a nonempty conflicting destination. Exact replay is the only retry.
- `doctor` and `migration-*` are operator CLI commands, not `workflow_state` operations.
- Sequences live in the [how-to index](../howto/README.md#storage-migration), not here.
