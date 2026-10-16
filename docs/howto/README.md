# How-to guides

Everyday tasks this project is set up for. Each how-to is numbered
steps, then **Eat** — the check that it worked.

## OMP commands

1. [Run the /code-review command](run-code-review.md)
2. [Configure and activate a Buck model profile](configure-buck-model-profiles.md)
3. [Prune retained /code-review runtime](prune-code-review-runtime.md)
4. [Inspect project token use](inspect-project-token-use.md)
5. [Watch /buck-loop activity](watch-buck-loop-activity.md)
6. [Recover a blocked /buck-loop run](recover-buck-loop.md)
7. [Recall project memories](recall-project-memories.md)
8. [Resume /buck-loop after a supervisor repair](resume-buck-loop-after-repair.md)
9. [Change /buck-loop activity density](change-buck-loop-density.md)
10. [Turn automatic SQL memory capture off](toggle-turn-memory.md)

## Durable workflow state

1. [Read a workflow artifact by token](read-workflow-artifact-by-token.md)
2. [Install Bubblewrap for restricted stages](install-bubblewrap-for-restricted-stages.md)
3. [Restore auto-fix evidence](restore-auto-fix-evidence.md)
4. [Restore pinned PR evidence](restore-pinned-pr-evidence.md)
5. [Enable checkpoint publication](enable-checkpoint-publication.md)
6. [Inspect sealed checkpoints](inspect-sealed-checkpoints.md)
7. [Map a rewritten checkpoint](map-rewritten-checkpoint.md)
8. [Revoke a checkpoint mapping](revoke-checkpoint-mapping.md)
9. [Resolve a publication conflict](resolve-publication-conflict.md)
10. [Export an orphan scope](export-orphan-scope.md)
11. [Rebind an orphan scope](rebind-orphan-scope.md)

## Storage migration

1. [Export a storage snapshot](export-storage-snapshot.md)
2. [Import a storage snapshot](import-storage-snapshot.md)
3. [Switch storage backend](switch-storage-backend.md)
4. [Resume a storage cutover](resume-storage-cutover.md)
5. [Roll back a storage cutover](rollback-storage-cutover.md)
6. [Quarantine legacy memory](quarantine-legacy-memory.md)

## Why

- [Local-only isolated code-review loop](../adr/0001-local-only-isolated-code-review-loop.md)
- [Observably invoked happy-path loop](../adr/0002-observably-invoked-happy-path-loop.md)
- [Checkpoint trusts durable artifacts](../adr/0003-checkpoint-trusts-durable-artifacts.md)
- [Model access uses workflow_state](../adr/0004-workflow-state-trusted-access.md)
- [Publication is a versioned integration view](../adr/0005-versioned-integration-view.md)
- [Backend cutover is an offline verified switch](../adr/0006-offline-verified-storage-cutover.md)
