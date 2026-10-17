---
status: completed
phase: 3
order: 3
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Port lifecycle, links/backlog discovery, memory correction/idempotency, and save batch/attempt/receipt semantics onto the storage contract with branch-scoped visibility."
files:
  - skills/_shared/scripts/subject-lifecycle.ts
  - skills/_shared/scripts/context-helpers.ts
  - skills/_shared/scripts/plan-acceptance.ts
  - extensions/buck-loop/
from_plan_steps: [3]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] Subject lifecycle inspection/transitions run storage-neutrally through the store API; adapter reads + conditional writes; evidence verification before close and malformed-provenance refusal preserved on every backend."
  - "[x] Memory correction/idempotency: scoped corrections affect only the owning branch view; a correction on branch A never invalidates branch B's published predecessor; global supersession impossible."
  - "[x] Save batches/attempts: attempted run/project/branch/revision identities must match; no-fact saves remain meaningful; receipt complete only after required metadata duties succeed; same-scope readback verified."
  - "[x] Links/backlog/index discovery use the current-branch-overlay + published-baseline view; completed subjects stay excluded per lifecycle authority."
  - "[x] Ordinary knowledge lookup applies visibility BEFORE body loading, ranking, LIMIT, and pagination on every backend — proven by fixture with high-scoring private candidates paginated out."
  - "[x] Copy-on-write branch views: current-branch revision overlays baseline; drafts never overwrite the published baseline."
completed_at: 2026-10-12
completed_by: null
sql_memory_ids:
  - 01a1322c-4fb7-7841-a266-5ac7e8fb8f0a
---

# Phase 3: Domain Semantics

## User Goal
Technical chore — semantics layer; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: choose durable storage, resume reliably, branch-private unmerged work. Builds on Phase 2 adapters. This phase replaces filesystem-specific lifecycle/save/scan logic and the immediate project-wide SQL recall policy with the branch-overlay visibility contract. Plan step 3.

## Implementation Details
1. Port `subject-lifecycle.ts`, `context-helpers.ts`, `plan-acceptance.ts` and the context/subject resolution + recall protocols onto the store API; lifecycle stays the single close authority with adapter-backed reads/conditional writes.
2. Implement memory correction/idempotency as branch-scoped revision overlays with tombstones; preserve correction history.
3. Save pipeline semantics: same-adapter batches, attempt receipts bound to run/project/branch/revision, completion only after metadata duties; outage/uncertain persistence blocks save.
4. Implement the visibility resolver: exact project's current-branch overlay over published integration baseline; apply before ranking/LIMIT/pagination; one native read surface; no generic unrestricted knowledge SQL tool.
5. Copy-on-write branch views with explicit publication pointers (publication semantics themselves are Phase 6).

## Risks
- Highest-blast-radius phase for existing consumers still on old paths — old callers may keep working until Phase 4/5 cutover; do not delete old paths here.
- Never let a raw SQL escape hatch remain reachable from normal recall.

## Verification
- Conformance fixtures extended: two branches, same-named subjects/artifacts independent; corrections/tombstones scoped; pagination filters private high-rank records before LIMIT; lifecycle refusal cases on all four backends.
- Save receipt mismatch and stale-writer fixtures fail closed.
- `npm run guardrails:check` passes.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
