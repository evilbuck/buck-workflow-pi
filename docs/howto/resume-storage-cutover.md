# Resume a storage cutover

Finish an interrupted config switch and consumer rebind after its switch journal exists.

## Steps

1. Keep all project writers stopped, including sibling worktrees. Set `CLI` to the installed absolute path of `skills/_shared/scripts/workflow-state-cli.ts`. Use the original checkout, config path, and private switch journal.
2. Resume:
   ```sh
   bun "$CLI" migration-resume '{"path":"/private/buck/switch.json","quiesced":true}'
   ```
3. **Eat:** the result reports `status: switched`; `bun "$CLI" doctor` reports the intended destination; a known artifact is readable. Only then restart writers.

Do not edit the journal or accept changed source/destination inventories to silence a refusal. A kill during destination staging, before this journal exists, is not this command: config stays on the source and the destination stays invisible. Proven-dead process locks are reclaimed; live or unknown lock owners require inspection, not automatic removal. If config or data changed independently, retain all evidence and investigate before proceeding. For a deliberate reversal, use [rollback](rollback-storage-cutover.md).
