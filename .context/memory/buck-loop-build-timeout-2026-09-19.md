---
date: 2026-09-19
domains: [extensions, workflow, testing]
topics: [buck-loop, nested-session, timeout, recovery]
related:
  - .context/2026-09-19.subject-work-state/plan-subject-work-state.md
  - .context/2026-09-19.subject-work-state/research-buck-loop-build-timeout.md
priority: high
status: completed
subject: 2026-09-19.subject-work-state
artifacts:
  - research-buck-loop-build-timeout.md
  - plan-subject-work-state.md
---

# buck-loop productive-session timeout diagnosis

## Outcome

Diagnosed two consecutive 900,000 ms `b-build` timeouts. Both nested sessions were productive; the fixed wall-clock timer, not a stalled agent, caused the failures. The second failure legally moved the authoritative loop state to `blocked`.

Changed `runStep` to use a 15-minute inactivity timeout refreshed by every child SDK event. Productive sessions now have no fixed wall-clock cutoff; genuinely silent sessions still abort. Added a red/green regression for activity beyond the timeout boundary.

## State and decisions

- Did not edit `.context/workflow/buck-loop.json` or invent a recovery edge.
- The documented recovery remains a normal `/buck-loop` resume, which applies the existing `USER_CONFIRMED: blocked -> resolving` transition when the plan is still present.
- The interrupted subject-work-state implementation remains active and uncommitted. Its tests, lifecycle audit, and deterministic guardrails are green, but the loop has not yet completed review/save/commit.

## Verification

- Timeout regression: red before fix, 19/19 green after fix.
- Buck-loop tests: 174/174.
- `npm run subject-lifecycle:check`: zero violations.
- `npm run guardrails:check`: pass under the durable v2 contract.
