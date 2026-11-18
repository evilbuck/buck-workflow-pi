---
date: 2026-11-17
domains: [b-loop, omp, workflow, recovery, stages]
topics: [b-loop, stage-tools, omp-judge, review-fingerprint, save-receipt, run-state]
related: [.context/2026-11-17.b-loop-repair/phase-3-stage-boundaries.md, .context/2026-11-17.b-loop-repair/review-phase-3-stage-boundaries.md, .context/2026-11-17.b-loop-repair/iterate-phase-3-stage-boundaries.md]
priority: high
status: completed
subject: 2026-11-17.b-loop-repair
artifacts:
  - phase-3-stage-boundaries.md
  - review-phase-3-stage-boundaries.md
  - iterate-phase-3-stage-boundaries.md
  - plan-b-loop-repair-phases.md
---

# `/b-loop` Repair Phase 3: Stage Boundaries (`build`, `review`, `save`) & Acceptance

## Summary
- Implemented `skills/b-loop/scripts/stages.ts` and wired default `build`, `review`, `save` adapters (plus Phase 3 `commit` stub pending Phase 4) into `eval-buck-loop.ts` with private `run-state` persistence via `checkpoint-cli.ts --kind run-state` and clean rewind support in `recovery.ts` (`MAX_PHASE_REWINDS = 3`).
- Verified live `omp` 18.22.0 `eval` IPC contracts (`__agent__` returns `{ id, agent }`, `__wait__` resolves snapshot `.text`, `__judge__` returns `result.answers` directly) and wired keyed-object `judge(state, questions)` (`bool >= 0.7`, finite check, fail closed), partial worktree preservation, and deterministic `computeWorktreeFingerprint` (tracking symlinks, modes, staged diffs, deletions while excluding `.context/workflow/` and review/iterate reports).
- Enforced restricted `STAGE_TOOLS`, removed `judgeBatch` ranking and automatic `b-iterate`, bound `b-review` strictly to `BuildStageProof`, preserved `iterate-*.md`/`review-*.md` blocking `save` at `b-review finished · blocked`, and sealed `b-save` receipts matching `domain.ts` (`no-fact` `attempted` -> `rows` `attempted` -> `complete` with `metadataDuties` + strict `read-receipt` verification + `workflow-state-cli.ts` role fallback + `sql-save-attempt.json` guards).

## Verification
- `npx vitest run skills/b-loop/scripts/stages.test.ts`: 12/12 passed; `lizard -C 10 -w` on `skills/b-loop/scripts/*.ts`: 0 warnings; `npx tsc --noEmit` (`skills/b-loop`): 0 errors.
- `npm run guardrails:check`: `status: "pass"`, `unit_test_gate: "pass"`, `coverage.current: 88.3` (baseline `84`), `complexity_gate: "pass"` (`new_violations: []`).
