# Watch `/buck-loop` activity (Historical — Unwired `extensions/buck-loop/`)

> [!NOTE]
> Applies only to the unwired historical `extensions/buck-loop/` prototype. The active `/b-loop <subject>` runner is prompt-backed (`prompts/b-loop.md` + `skills/b-loop/`) and emits shared `starting`/`working`/`finished`/`verified` progress directly via OMP `phase()` and `log()`; legacy status/resume/stop flags and `.context/workflow/buck-loop.log.jsonl` exports were removed. See [`docs/buck-loop.md`](../buck-loop.md).

## Steps

1. Historical reference only: `extensions/buck-loop/` is unwired, and the active loop is prompt-backed `/b-loop <subject>`. In the legacy prototype, JSONL activity logs were written under `.context/workflow/buck-loop.log.jsonl`.
2. From another terminal in the same repository, operators previously ran:

   ```bash
   tail -F .context/workflow/buck-loop.log.jsonl
   ```

3. Each legacy record had `version: 1`, an ISO-8601 UTC `timestamp`, an invocation UUID, and a `type`: `invocation`, `progress`, `activity`, or `terminal`.
4. Legacy status and stop queries did not alter the export file; `/b-loop <subject>` writes no activity log file and instead retains private checkpoints via `FileStorageStore`.
5. The legacy export lived in `.git/info/exclude` (untracked on start if tracked, truncated on fresh start without deleting previously retained revisions) and omitted raw prompts, raw SDK events, complete child transcripts, and tool arguments.
6. If logging failed or pending writes exceeded the 1 MiB buffer limit, the legacy drain disabled itself for that invocation with one warning without stopping the loop.
7. **Eat (for active `/b-loop <subject>`):** observe live `Phase N · starting|working|finished|verified` status via OMP `phase()` and per-stage `log()` milestones; for persisted progress or blockers, see [Recover `/b-loop` after interruption or failure](recover-buck-loop.md) and [`docs/buck-loop.md`](../buck-loop.md).
