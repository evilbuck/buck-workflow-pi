---
date: 2026-09-30
domains: [tooling]
topics: [buck-loop-log-drain, buck-loop, streaming, jsonl, observability]
subject: 2026-09-24.buck-loop-streaming-log-drain
artifacts:
  - extensions/buck-loop/activity-log.ts
  - extensions/buck-loop/__tests__/activity-log.test.ts
  - extensions/buck-loop/__tests__/wire.test.ts
  - extensions/buck-loop/index.ts
  - extensions/buck-loop/run-step.ts
  - docs/howto/watch-buck-loop-activity.md
  - .context/2026-09-24.buck-loop-streaming-log-drain/plan-buck-loop-streaming-log-drain.md
  - .context/2026-09-24.buck-loop-streaming-log-drain/iterate-buck-loop-streaming-log-drain.md
related: []
priority: medium
status: completed
---

# `/buck-loop` activity-log JSONL drain shipped

`/buck-loop start` and `--resume` now write a versioned JSONL record stream to `.context/workflow/buck-loop.log.jsonl`, exposing normalized progress, activity, synthetic-failure, and terminal events on disk while the loop is still running so an operator can `tail -F` from another terminal.

The drain was implemented in PR #51 (merged `0a82064`, 2026-09-27) via `extensions/buck-loop/activity-log.ts` (180 lines) plus a 149-line unit suite, with fan-out wiring added in `loop.ts`, `run-step.ts`, and the `index.ts` composition root. The post-review iterate artifact recorded two critical fixes (bounded wall-clock deadline for the live-drain assertion; supervisor exceptions synthesize `blocked` rather than recording `idle`) and two warnings (bounded 1 MiB pending-byte budget using `write()`/`drain`/`finish` instead of a per-record Promise chain; share one warning budget between hygiene and writer failures). Both critical fixes and both warnings landed in review commit `a490963`. Focused regressions (20) and a real `tail -F` smoke observed activity before terminal/close, and unit/coverage guardrails passed.

`/buck-loop status` and `/buck-loop stop` never touch the file; the path is locally Git-ignored via `.git/info/exclude`. Logger failures warn once, disable the drain, and never alter supervisor state.