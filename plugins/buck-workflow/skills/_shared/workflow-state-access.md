# Workflow state access

Durable Buck artifacts are addressed by an artifact reference, not by a required physical path.

Reference: `{ subjectId, kind, logicalName, revision? }` or token `workflow-artifact:<base64url>`.

Use the native `workflow_state` tool when it is registered. Otherwise use the shared CLI:

```bash
bun skills/_shared/scripts/workflow-state-cli.ts <op> [--subject <id>] [--branch <ref>] '<json>'
```

Operations: `read`, `list`, `search`, `write`, `correct`, `discover`, `inspect-lifecycle`, `transition`, `read-receipt`, `write-receipt`. Operator-only operations are `inspect`, `recover`, `publication-view`, `map-checkpoint`, `revoke-mapping`, and `resolve-publication`; restricted stages cannot call them. `inspect` selects a local branch ref. `migrate` is CLI-only administration.

Do not pass `projectId`, `branchId`, `publishedRevisionIds`, `worktreeId`, or `runId`. The trusted runtime binds project and visibility. Do not construct SQL. Do not call `sql_memory`. Do not copy canonical bodies into a hidden local file.

Repo-files may project `.context/<subject>/<logicalName>`. That path is an optional editable view, not an input. Other adapters must not materialize a canonical `.context` mirror.

Trusted context resolution keeps one origin/config snapshot for both identity and backend selection. Identity registration is a serialized machine-local transaction; an abandoned identity lock fails closed with a timeout and requires operator recovery. Named branches keep a stable workspace identity. A receipt run is bound to one branch, worktree, and attempt; a later attempt gets a new run, and another branch cannot read or resume the previous receipt.

Repo-files immutable manifests and revision blobs live under the machine identity registry's `projects/<project-id>/repo-manifest`, outside Git. Only editable bodies belong in `.context/`.

The standalone CLI is an operator/portable-agent executable. Ordinary lifecycle/correction/receipt operations use save permissions; explicit cross-scope inspection, recovery and publication administration use admin permissions. Token-only reads derive their subject from the token.

Nested Buck stages have native workflow_state, checkout-confined file tools, and Linux `workflow_exec` isolation. Host bash is not available. File tools resolve symlinks and refuse paths outside the checkout, including machine storage, identity, configuration, and credentials. Bubblewrap is required; absence or isolation failure fails closed. Execution sees the checkout and runtime dependencies but not machine storage/configuration, host credentials or network. Git metadata is read-only except for the commit checkpoint stage; the supervisor stages the declared checkpoint. Use native artifact operations inside nested stages, not the operator CLI. No caller-editable role/environment flag authorizes host storage access.

## Checkpoint publication and recovery

Set the project's full `integration_ref` in machine configuration to enable
publication. There is no implicit integration branch and no automatic fetch.
The loop seals the exact current branch snapshot before invoking its commit
stage, retains the seal ID in its durable commit checkpoint, and binds the seal
only after Git verifies the resulting commit. Failed binding leaves the seal
private and recoverable. Binding freezes a resolved commit OID descended from
the sealed source; creation HEAD alone never authorizes publication.

Before ordinary retrieval, the runtime reconciles the selected adapter's
checkpoints against the current local integration tip. Only the bound commit
(or an explicitly mapped rewritten target) can authorize the frozen revisions.
Post-seal edits remain private. Missing/unprovable refs fail closed. Rewritten
integration history revokes unreachable evidence; reverting code does not
delete stored knowledge.

With publication configured, discovering a repo-files projection without a
current-branch pointer imports only observable local index/worktree changes
or new untracked files. Clean tracked bodies may be inherited or merged,
including committed post-seal edits, so discovery never turns those bytes
into branch-local drafts. The sealed integration view remains authoritative.
To adopt legacy/inherited bytes deliberately, use an explicit `write` (or
selected-scope recovery for retained revisions). Existing branch-owned
projections still reconcile direct edits. Failed Git observation never
authorizes a new projection import.

Integration views, proofs, mappings and resolutions are immutable adapter
revisions in a runtime-private scope, advanced with compare-and-swap. Independent
revisions of one logical artifact preserve the last unambiguous reachable
baseline and both conflict candidates. Other artifacts still advance.
Cross-branch supersession requires persisted artifact-correction ancestry;
merging code does not silently resolve independent knowledge edits. Ordered
checkpoints on the same branch incarnation can advance that branch's artifact.
Correction lineage retains tombstone revision IDs, while deletion and its
idempotent replay still return no artifact body.
`publication-view` exposes the view and exact checkpoint manifests to the
operator. `resolve-publication` takes a selected candidate `revision`; its
resolution applies only to that exact candidate set.

`map-checkpoint` takes `checkpointId`, the full exact `revisionSet` (revision
and SHA-256 pairs), `targetCommit`, and explicit non-patch-id-only `evidence`.
Project identity comes from the runtime. The target must be reachable from the
configured integration ref. Partial, duplicate, extra and other-checkpoint
mappings are refused. `revoke-mapping` removes a selected checkpoint mapping.
Mappings never authorize other checkpoint members or other projects.

`recover` without arguments lists retained named, workspace and selected-adapter
scopes, with checkpoint provenance. Select one returned `scopeToken` and an
`action` of `export` or `rebind`. Export returns immutable bytes; rebind creates
new branch-private revisions with source provenance and refuses collisions
instead of overwriting the current branch. Old revisions remain retained.
Deletion, rename, same-name recreation, detached HEAD and unborn branches do
not publish, delete or implicitly inherit private knowledge. Run projections,
receipts, import cursors, pass audits and attribution remain private after merge.
