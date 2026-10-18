---
status: completed
date: 2026-09-19
updated: 2026-09-19
subject: 2026-09-19.subject-work-state
topics: [buck-loop, timeout, nested-session, recovery]
informs:
  - plan-subject-work-state.md
---

# Diagnosis: productive buck-loop builds hit a hard timeout

## Symptom

`/buck-loop` ran `b-build` for `plan-subject-work-state.md`. The first nested work session timed out after exactly 900,000 ms, the built-in retry remained productive, and that retry also timed out after exactly 900,000 ms. The authoritative projection then moved from `building` to `blocked` with `building session failed again after one retry (timed out)`.

## Evidence

- The fast reproduction command detected the persisted failure state in 0.06 seconds: `RED: building; building session failed; retrying once`.
- The first session left a substantial partial implementation: 56 tracked files changed plus new lifecycle authority files.
- The retry continued editing, made the focused tests and `npm test` pass, fixed lifecycle-audit findings, and was still refactoring required complexity findings when the second hard deadline fired.
- `extensions/buck-loop/run-step.ts` armed one fixed 15-minute timer before `session.prompt()`. SDK activity only fed the viewport; it never refreshed the deadline.

## Root cause

The 15-minute limit measured total wall-clock duration, not inactivity. It therefore classified a long but continuously productive `b-build` as failed. The plan is an unusually broad non-phased migration, so the hard wall fired twice while useful work was still landing.

## Corrective action

- Renamed the contract to `WORK_SESSION_IDLE_TIMEOUT_MS`.
- Subscribed to child SDK activity even when no viewport callback is present.
- Reset the 15-minute inactivity timer on every child event.
- Kept `TimeoutError`, but changed its message to report inactivity rather than elapsed wall time.
- Added a regression that advances fake time past 15 minutes while emitting activity and proves the child is not aborted.

The loop projection was not edited. It remains `blocked`; only a normal `/buck-loop` resume may apply the existing `USER_CONFIRMED: blocked -> resolving` transition.

## Verification

- Red phase: focused regression failed because the productive session returned `TimeoutError`.
- Green phase: `extensions/buck-loop/__tests__/run-step.test.ts` — 19/19.
- Buck-loop suite: 174/174.
- Lifecycle policy audit: `{"ok":true,"violations":[]}`.
- Deterministic guardrails: `status: pass`, durable v2 contract.
