---
status: completed
date: 2026-09-30
subject: 2026-09-30.buck-loop-save-commit-handoff
topics: [buck-loop, sql-memory, commit-checkpoint, failure-classification]
informs:
  - plan-save-commit-handoff.md
---

# Research: buck-loop save/commit handoff failures

Observed during the 2026-09-29/30 decision-closure run (subject `2026-09-16.decision-closure`, Phases 3–6, ~7 loop cycles).

## Failure mode 1: successful saves reported as SqlMemoryError

Sequence each time: nested b-save child wrote `sql-memory-receipts/<runId>-<attemptId>.json` with `completed: true` and `probed: true`, activity log showed `agent finished ok:true`, then `toolEnd b-save ok:false "Configured SQL memory operation failed"`.

Code path: `extensions/buck-loop/run-step.ts`:
- `:414` `let sqlFailed = false` — single latch for the whole session.
- `:445` `sqlMemoryTool(pool, role, () => { sqlFailed = true; })` — any failed op latches it, including recoverable ones the agent corrects.
- `:500-505` cleanup path: `pool.end()` rejection sets the same flag (`poolEndError`).
- `:466-468` if the flag is set, the outcome is **overridden** with `SqlMemoryError` even when `outcome.ok` was true and the receipt verifies.

So teardown noise and corrected mid-session failures get promoted to stage failure. The loop then burns its one retry (`saving → saving "saving session failed; retrying once"`, machine.ts `${state}-session-retry`) re-running the entire save.

Counter-evidence check: receipts for attempts ba075c7c (Phase 2), e27614d2 (Phase 3), 92d46c7c (Phase 5) all show `completed: true` — the SQL work itself succeeded every time. No receipt exists without a subsequent successful retry, i.e. no case where the failure was a genuine final-op failure.

## Failure mode 2: commit checkpoint blocks on the phase's own deliverables

`extensions/buck-loop/loop.ts:927-938` `prepareCommitCheckpoint` throws when `unstagedNonContextStatus` is non-empty. The b-build child for a skills phase produces `skills/**` + `plugins/buck-workflow/skills/**` edits; when any of these remained unstaged at commit time (child staged some but not all, or review/save steps touched them after), the guard fired:

- Phase 2: `M skills/_shared/SKILL.md, ?? skills/_shared/decision-closure.md, + mirrors` → manual commit `c44b383`
- Phase 3: same shape (b-grill*) → `bb7ecec`
- Phase 4: same shape (b-plan/b-phase) → `80fbb2c`
- Phase 5: `M skills/b-build/SKILL.md, skills/b-review/SKILL.md, + mirrors` → `f30ba7e`

All four blocked commits contained exactly the phase's declared deliverables; zero contained unrelated work. The guard's safety intent (don't sweep unrelated changes) never actually triggered on unrelated changes.

## State machine handling (context, not a defect)

`machine.ts` `${state}-session-retry` (one retry), then `-session-failed-again` → blocked. `committingAutomatic` advances on `postconditionConfirmed` (git clean for committing state, scan.ts:466). The external manual commits made the tree clean, which is why the loop could advance each time after the fact.

## Fix direction (see plan)

1. Classify SQL failures: work-failure (final blocking op) vs teardown-failure; only the former overrides the outcome. Receipt verification already exists as ground truth (`verifySqlSave`, `finishSqlSave` at loop.ts:696-700).
2. Auto-stage the phase's declared `files:` frontmatter in `prepareCommitCheckpoint` before the guard; keep the guard for out-of-scope paths.
