---
status: pending
phase: 1
order: 1
plan: plan-buck-loop-extension.md
phases_overview: plan-buck-loop-extension-phases.md
difficulty: hard
model_hint: strongest reasoning model available — this phase freezes the legal state, choice, snapshot, and effect contracts consumed by every later phase
buck_hint: /b-build-hard
goal: "Define and prove the pure buck-loop transition contract without I/O, SDK calls, or implicit advancement."
files:
  - extensions/buck-loop/types.ts
  - extensions/buck-loop/table.ts
  - extensions/buck-loop/__tests__/table.test.ts
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[ ] `LoopState`, `Snapshot`, `Choice`, and `Effect` express the parent plan's user-visible states and legal machine actions without importing XState."
  - "[ ] `legalChoices(state, snapshot)` and `next(snapshot)` are pure: no filesystem, git, process, clock, or OMP SDK access."
  - "[ ] Missing plan resolves to `blocked`; an incomplete phase resolves to `building`; all completed phases resolve to `done`; loop or iterate limits resolve to `blocked`."
  - "[ ] Review priority is deterministic: iterate artifact before documentation impact before save."
  - "[ ] Ambiguous review or postcondition cases return a closed `choose` effect containing only currently legal choices; no raw model string can transition state."
  - "[ ] Focused transition-table tests pass and cover every required branch from parent plan step 1."
completed_at: null
completed_by: null
---

# Phase 1: Transition Contract

## Context

Parent user goal: An operator can leave a well-scoped Buck plan running unattended through build → review → iterate-if-needed → docs-if-needed → save → commit → next phase, without XState. Every transition is either a deterministic disk/git check or a closed-set LLM choice the machine validates.

This is the schema gate for every later phase. Keep it boring and pure: artifacts are represented as snapshot facts; effects describe work but do not perform it.

## Implementation Details

1. Create `extensions/buck-loop/types.ts` with the minimum discriminated unions and records needed by the parent plan:
   - user-visible states: `idle`, `resolving`, `building`, `reviewing`, `iterating`, `documenting`, `saving`, `committing`, `blocked`, `done`, `aborted`;
   - projection `Snapshot` fields, including subject/plan/phase identity, safety counters, artifact facts, optional last accepted choice, and transition history;
   - closed `Choice` and `Effect` variants. Separate work effects from choice effects so execution code cannot smuggle a transition through free text.
2. Create `extensions/buck-loop/table.ts` with explicit legal edges and pure `legalChoices` / `next` logic. Deterministic guards win; only genuinely ambiguous cases produce `{ kind: "choose", legal: [...] }`.
3. Encode the parent priority order exactly: iterate > document > save. A loop count at the maximum or three iterate cycles on one phase blocks before another work effect is emitted.
4. Start with failing fixture tests, then implement the table. Cover:
   - missing plan;
   - active incomplete phase or non-phased plan;
   - all phases complete;
   - iterate artifact present;
   - documentation/how-to impact without iterate;
   - clean review;
   - loop and iterate limits;
   - ambiguous review and ambiguous postcondition legal sets.
5. Do not add filesystem helpers, model calls, command parsing, or supervisor behavior in this phase.

## Risks

- An exhaustive-looking switch can still hide a default advance. Terminal or unsupported combinations must block or fail explicitly.
- If snapshot fields encode filesystem mechanics rather than domain facts, Phase 2 will couple the pure table to parser details. Keep the boundary semantic.
- Over-generalizing effects now creates a second orchestration framework. Model only the parent plan's bounded happy path.

## Verification

- Run `vitest run extensions/buck-loop/__tests__/table.test.ts`.
- Inspect imports under `types.ts` and `table.ts`: no `xstate`, filesystem, git, process, or OMP SDK dependency.
- Confirm every ambiguous fixture asserts the exact legal set and every deterministic fixture asserts that no choice effect is emitted.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the session resumes here next turn.
