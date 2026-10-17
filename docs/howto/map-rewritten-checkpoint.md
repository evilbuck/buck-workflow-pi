# Map a rewritten checkpoint

Publish one sealed checkpoint after a squash or rebase. Patch equivalence is not enough.

## Steps

1. Copy the checkpoint id and the full `revisionSet` from [Inspect sealed checkpoints](inspect-sealed-checkpoints.md). Every revision and hash pair must be present. Do not drop, duplicate, or borrow another checkpoint's members.
2. Name the rewritten commit that is already reachable from the configured integration ref, and one evidence string that is not a `patch-id:` value.
3. Record the mapping:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts map-checkpoint '{"checkpointId":"CHECKPOINT","revisionSet":[{"revision":"REVISION","sha256":"HASH"}],"targetCommit":"TARGET","evidence":["operator-attested squash of CHECKPOINT"]}'
   ```

4. **Eat:** the command exits 0 and prints a JSON array. A following `publication-view` lists that `checkpointId` under `mappings`, and `view.members` includes that checkpoint's revisions. `patch-id` alone, a partial set, or an unreachable target exits non-zero and adds no mapping.

To withdraw it, use [Revoke a checkpoint mapping](revoke-checkpoint-mapping.md).
