---
status: completed
phase: 1
order: 1
plan: plan-review-severity-ranking.md
phases_overview: plan-review-severity-ranking-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build-hard
goal: "Establish the ranking state contract: types, persistence, scan ignore rules, the iterate-artifact parser, and the pure waterline function."
omp_execution: orchestrate
files:
  - extensions/buck-loop/types.ts
  - extensions/buck-loop/persist.ts
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/ranking.ts
  - extensions/buck-loop/__tests__/scan.test.ts
  - extensions/buck-loop/__tests__/persist.test.ts
  - extensions/buck-loop/__tests__/ranking.test.ts
from_plan_steps: [1, 2, 9]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] `ranking` is a `LoopState`, excluded from `WorkState`, accepted by `persist.ts`, and included in `FROZEN_PHASE` but not `IN_CYCLE_WORK_STATES`; old projections still load (persist test)."
  - "[x] `{ kind: \"rank\" }` exists on the `Effect` union."
  - "[x] `hasIterate()` ignores `status: below-waterline` the way it ignores `completed` (scan unit test — A-9 validated)."
  - "[x] The parser reads an unfinished `iterate-*.md` fixture copied from the `b-review` SKILL template into ids `critical:<n>` / `warning:<n>`, requiring a title and Problem bullet, accepting **Suggested approach** as the fix field (A-1 validated)."
  - "[x] Zero parsed issues from a file `hasIterate()` accepts is representable as a scan defect, and two unfinished iterate files produce a blocked input rather than a pick (A-10 validated)."
  - "[x] Pure `aboveWaterline()` unit-tested with no network: likelihood 0/1 caps the cell at Medium, regression clears Medium only when impact >= 2, out-of-scope and P(real) < 0.60 and missing answers are below."
  - "[x] `ranking.ts` imports neither `choose` nor `callChoiceModel`."
completed_at: 2026-10-03
completed_by: b-build-hard
---

# Phase 1: Types, Scan, and the Pure Waterline

## Context

Parent user goal: the operator running autonomous `/buck-loop` stops paying time and tokens for review findings that do not matter to the end user or the business — after review, each in-plan issue is severity-ranked and only an issue above the waterline starts `b-iterate`.

This phase builds the inert foundation: state/effect vocabulary, persistence compatibility, the scan contract, the artifact parser, and the deterministic waterline. No machine edge, no Jev call, no routing change. Nothing observable changes in loop behavior yet — by design.

## Implementation Details

From plan steps 1, 2, and 9 (test layer):

1. `types.ts`: add `ranking` to `LoopState`; keep it out of `WorkState`; add `{ kind: "rank" }` to the `Effect` union. Add `ranking` to `FROZEN_PHASE`; do not add it to `IN_CYCLE_WORK_STATES`.
2. `persist.ts`: allow `ranking` so projections with it load; verify a projection written before this change still loads (no mid-cycle resume path required).
3. `scan.ts`: `hasIterate()` must also ignore `status: below-waterline` (A-9). This is the scan-side precondition for Phase 3's "complete the iterate artifact when nothing is above the waterline".
4. New `ranking.ts`:
   - Parser for unfinished `iterate-*.md`: issues with ids `critical:<n>` and `warning:<n>` (1-based ordinal per section), require title + Problem bullet, accept **Suggested approach** (warnings) as the fix field per A-1. Fixture: copy the shape specified in `skills/b-review/SKILL.md`.
   - Represent "an artifact `hasIterate()` accepts but which parses to zero issues" as a scan-defect result, and "two unfinished iterate files" as a blocked input (A-10) — the machine wiring of these comes in Phase 3.
   - Pure `aboveWaterline()` implementing the plan's waterline contract: scope `in_scope`; finite P(real) `>= 0.60`; impact/likelihood finite `0..4`; cell High/Critical from the plan matrix; regression bump requires cell >= Medium and impact >= 2; missing Q5 does not bump; likelihood 0/1 caps at Medium.

## Risks

- Parser drift from the real `b-review` template silently drops issues → mitigated by the fixture test (R-2's detection half).
- Widening `WorkState` by accident would let `ranking` host skill runs → asserted by a type-level or unit check.

## Verification

- `scan.test.ts`: completed artifact, `below-waterline` artifact, and `ranking-*.md` do not set `iterateArtifact` (A-3, A-7, A-9).
- `ranking.test.ts`: fixture parse, zero-issue scan-defect, two-file blocked, and the full `aboveWaterline()` table (cap, regression bump, missing answer, out of scope, P(real) below 0.60) — no network.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Type the `orchestrate` keyword anywhere in the first turn, then run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings route to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
