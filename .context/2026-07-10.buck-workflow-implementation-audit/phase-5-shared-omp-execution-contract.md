---
status: pending
phase: 5
order: 5
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; shared cross-skill runtime policy and goal audit
buck_hint: /b-build-hard
goal: "Make one shared contract own OMP detection, mode precedence, opt-in, and goal auditing."
files:
  - skills/_shared/SKILL.md
  - skills/_shared/omp-autonomy.md
  - skills/b-plan/SKILL.md
  - skills/b-loop/SKILL.md
  - skills/b-review/SKILL.md
  - skills/b-phase/SKILL.md
  - prompts/omp-orchestrate.md
  - prompts/omp-workflow.md
  - prompts/omp-goal.md
from_plan_steps: [5]
depends_on: [4]
dependency_type: HARD
acceptance_criteria:
  - "[ ] One shared source owns OMP harness detection and mode precedence"
  - "[ ] b-plan, b-loop, b-review, b-phase, and omp prompts consume rather than duplicate the contract"
  - "[ ] No targeted surface treats package.json omp metadata as runtime state"
  - "[ ] Observation prompts do not claim they activated a mode"
  - "[ ] b-loop remains advisory/stamp-only and its slash mirror remains deferred"
completed_at: null
completed_by: null
---

# Phase 5: Shared OMP Execution Contract

## Context

**Inherited parent goal**: Buck Workflow users receive one truthful recommendation and one completion-audit contract for user-toggled OMP execution modes.

`b-plan`, `b-loop`, `b-review`, and the three OMP prompts currently duplicate and disagree on detection, precedence, activation, and goal auditing. Phase 4 is the direct prerequisite because it consumes Phase 3's finalized review/save/stage boundary and establishes current eval semantics.

## Implementation Details

1. Create `skills/_shared/omp-autonomy.md` and register it in the shared skill index.
2. Canonicalize:
   - reliable active-harness evidence (`omp.runtime`/injected runtime context, never package metadata);
   - mode set `none | orchestrate | workflow | goal`;
   - deterministic recommendation precedence and tie-breaking;
   - user opt-in preconditions (`orchestrate`/`workflow` keyword or `/goal set`);
   - the six-step goal completion audit and its evidence sources;
   - user-toggled, advisory-only semantics.
3. Make `b-plan`, `b-loop`, `b-review`, and `b-phase` reference the shared contract instead of maintaining variants. Keep only local context needed to apply it.
4. Make `prompts/omp-*.md` truthful observation/instruction stubs. They explain how to activate a mode; opening the stub is not activation.
5. Remove hardcoded parent verification commands such as `bun check`/`bun test`; verification is discovered from the project.
6. Preserve the explicit `b-loop` no-slash-mirror deferral and its overview-table stamp behavior.
7. Add table-driven recommendation tests/fixtures so identical plan shapes receive identical answers from plan and loop paths.

## Risks

- **Shared file becomes a second executable skill**: keep it a referenced contract, not a new command or orchestrator.
- **Goal signal ambiguity**: consume actual runtime/system goal context; do not resurrect a legacy JSON owner.
- **Precedence churn**: test boundary cases—few independent phases, many hard dependencies, available workflow cell, and active goal.
- **User opt-in erosion**: no synthetic keyword or extension activation.

## Verification

- Feed the same plan-shape fixtures through `b-plan` and `b-loop`; recommendations and precondition text match exactly.
- Active Pi/non-OMP fixture returns `none` despite package metadata containing `omp`.
- OMP prompts state “how to activate,” not “you are now in mode.”
- Goal review consumes real active-goal context and runs the shared audit; absence of goal does not trigger it.
- `b-loop` remains skill-only; no new `prompts/b-loop.md` or `commands/b-loop.md` appears.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only.
2. Run `/b-review` against this exact phase file.
3. Iterate in-plan discrepancies, especially recommendation table boundary cases.
4. Run `/b-docs` if documentation impact is flagged.
5. Run `/b-save`, explicitly stage implementation plus durable artifacts, then `/b-commit`.
6. If incomplete, leave `status: in-progress`; Phase 6 must not consume a partially centralized contract.
