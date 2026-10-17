---
status: completed
date: 2026-09-29
subject: 2026-09-29.buck-loop-ambiguous-repair
topics: [buck-loop, code-review]
review_verdict: request-changes
---

# Review: ambiguous buck-loop repair

## Plan source

`plan-buck-loop-ambiguous-repair.md`; baseline is the existing working-tree draft against HEAD. Review applies only to the supervisor files, not the unrelated staged SQL-memory notes.

## Completion matrix

| Step | Status | Evidence |
| --- | --- | --- |
| Keep draft and bound complexity | Complete | Draft retained; `lizard -C 10 -w` reported no violations. |
| Fix-or-stop, checked-phase repair, one retry, retry budget | Complete | Temp-repo `handleLoop` tests: 118 passing across ambiguity, loop, and machine; standalone stop smoke persisted the phase status, unchecked box, and checkpoint. |
| Restart after loop-extension repair | Partial | The current invocation stops, but a subsequent `--resume` in the same process goes through `resumeRun` without a restart guard. |
| Guardrails | Complete | Durable v2 verdict `pass`: required unit, global ratchet, and complexity gates pass; lint and functional skipped, patch pass. |
| Scoped commit | Pending | Commit follows review/save and must exclude staged SQL-memory notes. |

## Review axes

- Spec axis worst finding: in-plan stale-process re-entry, below.
- Standards axis worst finding: none (sequential TypeScript and universal-quality pass over the scoped diff; no cross-axis ranking).

## In-plan finding

`extensions/buck-loop/loop.ts`: `stopForExtensionRestart` blocks the invocation, but `handleLoop` permits a subsequent `start` or `resume` in the same loaded extension instance. That can execute work under stale code before the operator restarts OMP. Gate further work commands in the current process and keep the saved restart reason; a fresh process must be able to resume.

## Documentation impact

The supervisor now repairs checked phases, gates ambiguous retries through Jev, and requires an OMP restart after loop-extension edits. Update the existing architecture narrative and add an operator recovery how-to after iteration passes.

## Verdict

Needs work — fix the in-plan re-entry path, then re-review. Live OMP proof after restart remains unexercised in this process.

This review finding was addressed in `iterate-buck-loop-ambiguous-repair.md` and re-reviewed in `review-ambiguous-repair-final-2026-09-29.md`.
