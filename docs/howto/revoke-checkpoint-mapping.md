# Revoke a checkpoint mapping

Remove one rewritten-history mapping so that checkpoint is no longer publication evidence.

## Steps

1. Copy `checkpointId` from `mappings` in [Inspect sealed checkpoints](inspect-sealed-checkpoints.md).
2. Revoke that mapping only:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts revoke-mapping '{"checkpointId":"CHECKPOINT"}'
   ```

3. **Eat:** the command exits 0 and prints a JSON array. A following `publication-view` no longer lists that checkpoint under `mappings`. Its revisions leave `view.members` unless a separate sealed ancestor still proves them. An unknown checkpoint exits non-zero.

This does not delete the sealed revisions. Reverting integrated code is not this command.
