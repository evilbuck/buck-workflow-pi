---
status: completed
date: 2026-10-16
completed: 2026-10-16
addresses: phase-6-publication-recovery.md
---
# Projection import boundary

Technical chore — in-plan defect repair for `phase-6-publication-recovery.md`, which carries the `## User Goal` section.

The assigned active rereview artifact has one blocking issue (the ranking removed the separate same-tip identity finding). Prior supervisor recall is reference only; no further SQL access is needed or authorized by the project access contract.

1. When publication is configured, missing branch pointers must not import clean tracked projections. Only observable local worktree/index edits or new untracked files may initialize a branch-local projection; Git observation failure refuses import. Existing branch-owned direct-edit reconciliation remains intact.
2. Exercise the actual CLI in fresh processes and two real worktrees: sealed tracked v1, committed unsealed v2, merge, list/search/read/discover and lifecycle access, then explicit local edits. Keep a consumer-visible regression.
3. Synchronize only changed canonical/bundle files, document the import boundary, run deterministic checks, complete the active iterate artifact and stage only assignment-touched files. Supervisor owns lifecycle, review/save/commit and loop routing. The stale session memory pointer belongs to Phase 4 and is intentionally unchanged.

## Verified result

- Fresh-process CLI/two-worktree regression and focused publication/file-store/workflow-state suites: 89 passed. Separate smoke: list/read sealed v1, unsealed search empty.
- Durable v2 guardrails passed: required unit/ratchet/complexity gates pass, coverage 88% against unchanged 84%; lint/functional disabled and patch advisory. No gate or baseline changes.
- Bun consumer tests: 70 passed. Node and Bun SQLite transaction smokes passed. Canonical/bundle parity passed for all three changed pairs.
- Assigned iterate artifact completed. Own implementation/docs/evidence staged; pre-existing unrelated work and ranked-removal changes were not newly staged. Supervisor retains review/save/commit and lifecycle/loop decisions.
