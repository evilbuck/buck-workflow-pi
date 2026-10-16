# Inspect sealed checkpoints

See which sealed snapshots are proven against the configured integration tip, and which are still private.

## Steps

1. Enable publication first: [Enable checkpoint publication](enable-checkpoint-publication.md).
2. From the project checkout, read the operator view:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts publication-view
   ```

3. **Eat:** stdout is JSON. `checkpoints` lists each seal, including `revisionSet` hashes and any `boundCommit`. `view.members` contains only proven revisions. `view.proofs` names a checkpoint that is unbound, not yet integrated, workspace-private, or unprovable. The process exits 0.

Do not pass `publishedRevisionIds`. A clean tracked file in `.context/` is not a seal. To attest a squash or rebase, use [Map a rewritten checkpoint](map-rewritten-checkpoint.md).
