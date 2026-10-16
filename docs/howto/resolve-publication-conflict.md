# Resolve a publication conflict

Choose one published candidate when two branches published different revisions of the same logical artifact. The other candidate stays retained. Unrelated artifacts are not part of the choice.

## Steps

1. Read `view.conflicts` from [Inspect sealed checkpoints](inspect-sealed-checkpoints.md). Copy the `revision` of the candidate to keep. Do not invent a revision that is not in that set.
2. Select it:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts resolve-publication '{"revision":"REVISION"}'
   ```

3. **Eat:** the command exits 0 and prints a JSON array. A following `publication-view` no longer lists that candidate set under `view.conflicts`, and `view.members` contains the selected revision for that artifact. The last unambiguous baseline is what remains if you do not run this command. A revision that is not a current candidate exits non-zero.

Merging the other branch's code does not make this selection. Why: [ADR 0005](../adr/0005-versioned-integration-view.md).
