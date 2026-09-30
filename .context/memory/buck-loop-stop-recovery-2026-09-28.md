---
date: 2026-09-28
domains: [workflow, extensions, testing, docs]
topics: [buck-loop, blocked-state, stop, recovery, commit-checkpoint]
related:
  - .context/memory/buck-loop-fix-pr-checkpoint-2026-09-28.md
  - docs/howto/recover-buck-loop.md
priority: medium
status: completed
---

# Buck-loop stopped-run notice and recovery

The repeated `Warning: buck-loop: aborted: STOP requested by operator from blocked` was a presentation error, not a new block. The preceding run had been blocked at its commit checkpoint because `skills/fix-pr/SKILL.md` was unstaged; a supported `--stop` then persisted the state `aborted`, replacing the visible reason with the STOP transition. The commit guard is deliberate: it refuses to stage or commit an unreviewed non-`.context` change.

`/buck-loop --status` now shows the blocker from the saved transition and its recovery action. A stopped run reports the prior blocker as historical, while `--stop` and `--status` are informational rather than warning-level failures. A repeated `--stop` leaves the recorded history unchanged. `--resume` on an already stopped run reports the fresh-start path instead of prompting for dirty-work confirmation. A still-blocked in-cycle run keeps the existing safe resume route; an interrupted commit checkpoint says to inspect the last commit and staged changes, commit only if necessary, then start the displayed phase path. Actual blocked start/resume failures still warn. A recovery how-to is indexed at `docs/howto/recover-buck-loop.md`.

## Verification

- Regression tests failed before the presentation fix, then `bunx vitest run extensions/buck-loop/__tests__` passed: 9 files, 241 tests. The command-level tests cover historical cause, informational STOP/status, idempotent stop, aborted resume, and distinct recovery routes.
- Live `wireBuckLoop` invocation against this repository's stopped projection yielded one `info` notice with the unstaged skill path and Phase 2 start path, not the generic STOP warning.
- LSP diagnostics were OK on both modified TypeScript modules and the new integration test.
- `npm run guardrails:check`: durable contract `pass`; required unit, global coverage ratchet (88 vs baseline 84), and complexity gates passed. The advisory patch gate reported `pass` with a `null` patch metric (no measured percentage); lint and functional gates skipped.
- Backlog remains unchanged: this was a completed command-surface defect, not an additional phase of the active fix-pr plan. Phases 2–4 of that plan remain pending; this change did not run them.
