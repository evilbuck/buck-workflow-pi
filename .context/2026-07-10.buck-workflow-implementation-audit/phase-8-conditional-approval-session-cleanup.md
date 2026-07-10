---
status: pending
phase: 8
order: 8
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: medium
model_hint: capable general model; bounded policy cutover after runtime and discovery contracts are settled
buck_hint: /b-build
goal: "Proceed directly from approved plans while asking only for material unresolved tradeoffs."
files:
  - skills/b-build/SKILL.md
  - skills/b-review/SKILL.md
  - skills/b-loop/SKILL.md
from_plan_steps: [8]
depends_on: [5, 6, 7]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Approved plan/phase inputs do not trigger a redundant approval question"
  - "[ ] Ambiguous ad-hoc work still asks one targeted material question"
  - "[ ] Build/review no longer claim an always-on session plugin tracks work"
  - "[ ] Goal audit does not depend on stale current-session.json.goal state"
  - "[ ] OMP modes remain user-toggled and no hidden orchestration is introduced"
completed_at: null
completed_by: null
---

# Phase 8: Conditional Approval and Session Cleanup

## Context

**Inherited parent goal**: Buck Workflow users can execute an approved plan autonomously while still being asked when a real unresolved tradeoff changes the contract.

Phase 5 defines runtime/mode signals, Phase 6 defines subject ownership, and Phase 7 discovers concrete verification. The remaining `b-build` policy still mandates interface/test approval and describes a plugin/session file that the wired runtime does not own.

## Implementation Details

1. Replace unconditional pre-code approval with a material-ambiguity gate:
   - explicit approved plan/phase with acceptance criteria and discoverable verification proceeds;
   - unresolved public interface, destructive data choice, or materially different test strategy asks one focused question;
   - minor multiple-valid choices use the conservative existing convention without asking.
2. Preserve TDD and behavioral verification; removing redundant approval does not remove planning or tests.
3. Remove language that an always-on plugin tracks the session automatically.
4. Stop instructing `b-build`/`b-review` to create or treat `.context/workflow/current-session.json` as canonical ownership. Durable plan/phase/review/memory artifacts are the state.
5. Make goal auditing consume the shared Phase 5 runtime signal rather than `current-session.json.goal`.
6. Keep `b-loop` entrypoint wording consistent while preserving advisory/stamp-only and skill-only deferral.
7. Exercise approved and ambiguous scenarios behaviorally; do not validate by source-string assertions alone.

## Risks

- **Too few questions**: only skip questions when the plan resolves interface, acceptance, and verification; destructive or user-visible ambiguity still escalates.
- **Too many questions under autonomous modes**: a preference is not a material blocker. Use existing conventions and proceed.
- **Lost resume context**: phase/review/memory artifacts replace implicit JSON; verify cold-start resume through the overview.
- **Goal audit regression**: test both active and absent goal contexts.

## Verification

- Approved phase fixture with clear acceptance/discovery: build proceeds without asking for approval.
- Ad-hoc fixture with two materially different public APIs: one targeted question is asked before edit.
- Cold-start fixture with only durable subject artifacts: active phase resolves and work resumes without current-session JSON.
- Active OMP goal context triggers shared audit; a stale JSON file alone does not.
- No extension/state-machine or synthetic keyword activation is added.

## Per-Phase Execution Loop

1. Run `/b-build` against this phase file only.
2. Exercise both approved and ambiguous scenarios, then run `/b-review` against this exact phase file.
3. Iterate in-plan policy defects; route unrelated UX preferences separately.
4. Run `/b-docs` if documentation impact is flagged.
5. Run `/b-save`, stage implementation and durable artifacts, then `/b-commit`.
6. Leave `status: in-progress` if either side of the question/no-question boundary is unproven.
