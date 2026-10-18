---
status: completed
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
related: [phase-8-proof-docs-package.md, research-phase-8-live-workflows.md, research-phase-8-guarded-repair.md]
---
# Save identity mismatch discovered by the live workflow

## Observed boundary

The real PostgreSQL OMP workflow completed its phase, then canonical facts succeeded and metadata apply failed: `stale revision rejected: .context/2026-10-16.skill-proof/research/notes-adapter-proof.md`. Attempt `c01a65cc-279c-4746-83d9-312862e929eb`, run `run-7d506ac4-009e-4bbd-87be-6b316e0f5aef`, fact `fae8c405-c21d-420d-acb8-d5ed5d836b8c` were initially uncompleted. The repair subsequently completed and verified that exact attempt; no replacement or manufactured receipt was used.

Preflight retains the actual typed key for nested research. Apply's `saveSourcePath` instead reclassifies its filename, drops that same source, then rejects preflight's real revision as stale. `metadataRevision` repeats filename classification, so admitting the source alone would still write the wrong kind. This is a scanner/consumer identity mismatch, not missing research work.

Separately, apply already reads from `sourceArtifacts`/`pendingWrites` but still copies retained source bodies and provisional changes into the checkout before durable commit. Those copies are unnecessary for transforms and create unwanted narrative mirrors for non-repo adapters.

## Narrow repair

- Reuse preflight's existing typed source-to-logical-path mapping; retain subject/reserved-kind scope limits and fail closed on ambiguous paths.
- Preserve an existing artifact's kind when writing its metadata; use filename classification only for genuinely new logical sources.
- Perform metadata/moves in the existing in-memory working view. Let the selected adapter project its own committed bytes. Remove old checkout bodies only for repo-files moves/deletions; do not delete stale user exports for another adapter.
- Replace the obsolete projection-copy assertion with a real SQLite regression: a typed nested research row is updated under its original identity and links; stale local exports remain untouched; save bytes and the complete same-attempt receipt read back from the selected store.
- Run focused save tests, then retry the already-failed PostgreSQL attempt with fresh preflight and unchanged facts/identity. Re-run required guardrails after the source repair. Do not rebuild any workflow stage or alter the parent loop state.

## Trust boundary

Save source identities come from runtime-bound selected-store reads, not caller-supplied scope. Publication filtering, typed links, CAS revisions, path containment, subject scope, and attempt/duty verification remain enforced. No model-facing administrative access, raw SQL, backend fallback, or second authority is introduced.

## Executed repair proof

- `save-preflight.ts` exports its existing typed `contextPathOf` mapping. Apply reuses it, rejects conflicting logical paths, and preserves the existing typed key and links in `metadataRevision`.
- Source/move transforms remain in `sourceArtifacts`/`pendingWrites` until the selected adapter commits. Repo-files alone removes obsolete checkout projections; non-repo stale exports remain untouched.
- The real SQLite regression failed before the repair at the same nested research revision boundary. Afterward both focused suites passed **52/52**, including the original move/backlog cases. The final focused invocation passed again after the small complexity refactor.
- The genuine OMP PostgreSQL save resumed the original attempt/run/fact above. Metadata apply and lifecycle readback succeeded: lifecycle revision 3, `verifiedClosed: true`; receipt `complete`, kind `rows`, duties `save-metadata` and `readback`.
- A later fresh OMP process, after removing the noncanonical subject export directory, read phase `eb33ade3-1a8a-49d6-8c44-9378ed2f0110`, SHA-256 `2370834e10ee874dd6acf55e00ec57c005e9585aee0985ef963a2722514ea452`, and verified the same pinned complete receipt.
- The first post-repair runner found `metadataRevision` complexity 11 and a failed coverage invocation. The duplicate links expression was replaced with one existing-source binding, without changing guards or behavior. The subsequent full **unchanged durable v2 contract passed**: required unit/global-ratchet/complexity, coverage 89.5% against 84%, 29 hotspots against 30, no new/hard violations. No baseline or enforcement was changed.

