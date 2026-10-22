---
date: 2026-10-16
domains: [orchestration, testing]
topics: [buck-loop, jev, diagnosing, recovery]
related: [extensions/buck-loop/loop.ts, extensions/buck-loop/machine.ts, extensions/buck-loop/persist.ts, extensions/buck-loop/run-step.ts, docs/state-machine-diagram.html, docs/buck-workflow.md]
priority: high
status: active
subject: 2026-10-16.buck-loop-jev-halt-diagnose
artifacts: [iterate-buck-loop-jev-halt-diagnose.md, plan-diagnose-halt.md, draft-commit.md]

# Heavy-halt diagnosis iteration

## Outcome

All four in-plan review issues and the restart warning are addressed; iteration artifact completed. Re-review passed with warnings and no in-plan defects; `/b-docs` added the two missing `diagnosing` successor edges to the state-machine diagram and named the successor routing in `docs/buck-workflow.md`. Ready to commit.

- Saving heavy halt excludes the committing edge in both file and SQL modes.
- Diagnosing state is persisted before launching the child. Successful departure retires the halt-local attempt; a miss remains spent and cannot resume into a build.
- Invalid persisted diagnosis authority fields fail closed. Legacy absent/null fields remain readable; commit checkpoints are never invented.
- A diagnostic child that changes loaded runtime code requires restart. Fresh-process resume rescans the original proof without another child or build. Landed proof continues; missing proof holds a diagnose miss.
- Saving-origin SQL proof uses the existing receipt verifier, not a file-mode memory change. Thrown diagnosis errors remain visible in both the failure sink and blocker.

## Decisions and corrections

The initial review's suggested permanent hold on all extension-restart resumes was rejected: the existing recovery how-to explicitly allows fresh-process resume. Preserve the one-attempt/no-rebuild invariant by rescanning, not permanently refusing documented recovery.

Kept existing SQL verifier and checkpoint policy. Split validation and restart eligibility into focused helpers to satisfy required complexity limits; no baselines weakened.

## Verification

- Focused machine/loop/persist suites: 415 passed, 6 skipped; exit 0. SQL receipt integration remains environment-gated; no live SQL receipt success claimed.
- Mutation check: four regressions fail when saving exclusion, per-halt reset, pre-child persistence, and persisted attempts are removed. Restored all fixes before verification.
- Durable guardrails runner: exit 0; required unit, ratchet, complexity pass. Coverage 89.4% vs 84%; no new complexity violations. Lint/functional skipped; patch advisory. No baseline updates applied.
- Bun smoke: all eight origin/mode routes select diagnosing; real temporary Git projection retains a spent attempt and no checkpoint.
- context-mode guardrails command exceeded its transport's 30s timeout despite a larger request timeout. Reported tool issue; verification recovered with a captured subprocess via eval.

## Next action

Run `/b-commit`. Commit together with the sibling restart-fingerprint subject: its new regressions exercise this subject's diagnose path and are not independently shippable. Optional follow-up `/b-plan` for the `rescanAsOrigin` fail-open origin default and the `"heavy lift:"` magic-string coupling surfaced in review.
