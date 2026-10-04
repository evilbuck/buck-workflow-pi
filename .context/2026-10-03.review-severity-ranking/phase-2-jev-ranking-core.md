---
status: pending
phase: 2
order: 2
plan: plan-review-severity-ranking.md
phases_overview: plan-review-severity-ranking-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Implement the Jev-backed rank effect core: rankIssues() with one retry, the ranking audit file, and the iterate-artifact rewrite — as a callable unit, not yet wired into the loop."
omp_execution: orchestrate
files:
  - extensions/buck-loop/ranking.ts
  - extensions/buck-loop/__tests__/ranking.test.ts
from_plan_steps: [3]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `rankIssues()` calls `runJev` with the plan's five named questions per issue (scope/real/impact/likelihood/regression) and does no arithmetic in Jev; state sent is issue title, problem, file path, fix field, plan path, and the named file's current text — not the repo; a missing or too-big file is a Jev failure."
  - "[ ] A thrown judge call or a missing scope/real/impact/likelihood answer retries that issue once, in the same step, with another `runJev`; no second caller exists (R-4 test: a thrown judge error never invokes `choose` or `callChoiceModel`)."
  - "[ ] A second failure on an issue marks that issue valid (above the waterline for routing) and the first failure is noted on the issue; a missing Q5 answer does not bump (A-5, A-8 validated)."
  - "[ ] `ranking-<utc>.md` is written first with id, raw answer, cell, above/below, and any Jev-failure note; if the audit write fails, the function blocks and does not route onward or rewrite the iterate artifact (R-3 ordering)."
  - "[ ] The iterate artifact is rewritten to exactly the above-waterline ids and no others (unit test on content), or marked `status: below-waterline` when that set is empty."
completed_at: null
completed_by: null
---

# Phase 2: Jev Ranking Core and Audit Trail

## Context

Parent user goal: the operator running autonomous `/buck-loop` stops paying time and tokens for review findings that do not matter — after review, each in-plan issue is severity-ranked and only an issue above the waterline starts `b-iterate`.

Phase 1 produced the parser and the pure waterline. This phase builds the effect's engine on top of them: the Jev call, the retry rule, the audit file, and the iterate-artifact rewrite. Still no machine edge — the loop cannot reach this code yet, which keeps blast radius at zero while the hardest logic lands.

Deferred assumptions owned here: **A-5** (Jev unavailable or missing answers do not iterate; retry once; second failure treats the issue as valid) and **A-8** (one Jev call with named questions per issue suffices; one invalid answer fails only that issue; a thrown call fails that call's issues then one retry runs). Validation is the ranking unit tests with an injected ask function — no live judge in tests.

## Implementation Details

From plan step 3, on top of Phase 1's parser and `aboveWaterline()`:

1. `rankIssues(issues, deps)` where `deps.ask` is injectable (wraps `runJev`):
   - Five named questions per the waterline contract table (scope: choice; real: noul; impact/likelihood: score; regression: choice).
   - Jev state per issue: title, problem, file path, proposed fix / suggested approach, plan or phase path, current text of the named file. Missing or oversized file → Jev failure for that issue.
2. Failure semantics: first failure (thrown call or missing Q1–Q4 answer) → one retry, same step, another `runJev`, never `choose`/`callChoiceModel`. Second failure → issue marked valid (above waterline for routing) with a note that Jev failed and the finding should be re-reviewed with Jev. Missing Q5 alone does not bump and does not retry.
3. Audit: write `ranking-<utc>.md` **before** touching the iterate artifact. Each id, raw answer, cell, above/below, failure note. Audit write failure → block result; no rewrite.
4. Rewrite: iterate artifact contains only above-waterline issues, or `status: below-waterline` when none are above. Never set `completed:` (Q1 ruling).
5. Mapping of impact/likelihood labels to `0..4` and the cell matrix live with `aboveWaterline()` from Phase 1 — no duplication.

## Risks

- R-3: rewrite drops an above-waterline issue → mitigated by audit-first ordering and the exact-content unit test.
- R-4: a chat model imitates the judgment → mitigated by import ban (`choose`, `callChoiceModel`) plus the thrown-judge test asserting no second caller.
- Live-Jev differences from the injected fakes are untestable here; accepted, since the effect handler in Phase 3 uses the same injected seam.

## Verification

- `ranking.test.ts` (network-free, injected ask): two issues with one missing answer fails only that issue; first-call-throws-then-retry-succeeds (A-8); second failure marks valid with note (A-5); audit-first ordering; rewrite contains exactly the above-waterline ids; empty above-waterline set writes `status: below-waterline`; audit write failure blocks.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Type the `orchestrate` keyword anywhere in the first turn, then run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings route to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
