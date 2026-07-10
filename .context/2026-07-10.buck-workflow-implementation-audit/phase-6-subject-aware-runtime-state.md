---
status: pending
phase: 6
order: 6
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; runtime subject resolution across explicit and ambiguous multi-subject state
buck_hint: /b-build-hard
goal: "Resolve the actual active subject and phase without reviving implicit session orchestration."
files:
  - extensions/index.ts
  - extensions/buck-mode.test.ts
  - skills/_shared/subject-resolution.md
  - skills/b-loop/SKILL.md
from_plan_steps: [6]
depends_on: [1, 5]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Model auto-switch uses the explicit/active subject rather than lexicographically newest subject"
  - "[ ] One in-progress phase outranks later pending phases"
  - "[ ] Multiple ambiguous subjects cause a safe no-op or user selection, not a guessed switch"
  - "[ ] Extension tests cover explicit older target, completed newest subject, and numeric phase ordering"
  - "[ ] Deprecated orchestration/session files do not outrank explicit durable subject context"
completed_at: null
completed_by: null
---

# Phase 6: Subject-aware Runtime State

## Context

**Inherited parent goal**: Buck Workflow users working across multiple subjects receive model/runtime behavior for the work they actually selected.

The wired extension currently picks the lexicographically newest phases overview across `.context/`. Shared resolution also gives legacy workflow files ambiguous ownership. This phase aligns the runtime hook with explicit/current durable subject state while keeping `skills/b-build/SKILL.md` out of scope so Phase 7 may proceed independently.

## Implementation Details

1. Extract or implement one subject/phase resolver usable by the model-switch path. Resolution order: explicit command target; active conversation/command context available to the hook; single `in-progress` phase in an active subject; single unambiguous active subject; otherwise no switch.
2. Do not use folder date, lexicographic ordering, mtime, or a completed newest subject as ownership proof.
3. Parse phase numbers numerically and respect phase status. Phase 10 must not sort before Phase 2.
4. Tighten `skills/_shared/subject-resolution.md`: explicit context remains first; durable active artifacts are authoritative; deprecated `orchestration.json` and opportunistic `current-session.json` do not own an active session.
5. Keep `b-loop` wording consistent with the shared resolver without lifting its mirror deferral.
6. Expand `extensions/buck-mode.test.ts` around the resolution boundary rather than only testing “no phase.”
7. When the hook cannot prove a target, retain the current model and explain/no-op; an unsafe automatic switch is worse than no optimization.

## Risks

- **Hook lacks full prompt arguments**: use only observable context; ambiguity must no-op rather than invent state.
- **Resolver drift**: keep selection rules in a small shared/testable function and mirror the documented protocol.
- **Legacy subject formats**: support deterministic legacy plans or return no switch; never newest-folder fallback.
- **Cross-phase collision**: this phase does not edit `b-build`; Phase 8 handles skill-side session language.

## Verification

- Two dated subjects, newest completed and older active: switch uses the older active phase.
- Explicit path to an older subject: explicit target wins.
- One subject with Phase 1 completed, Phase 2 in-progress, Phase 10 pending: Phase 2 difficulty wins numerically.
- Two equally active subjects with no explicit target: no model switch occurs.
- Deprecated orchestration/current-session fixture cannot override explicit or active artifact context.
- Run focused `extensions/buck-mode.test.ts` model-switch cases.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only.
2. Run focused extension tests and then `/b-review` against this exact phase file.
3. Iterate any in-plan resolver defect; route unrelated extension findings separately.
4. Run `/b-docs` if documentation impact is flagged.
5. Run `/b-save`, stage implementation and durable artifacts, then `/b-commit`.
6. If ambiguity behavior is not proven safe, leave `status: in-progress`.
