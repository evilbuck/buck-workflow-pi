---
status: pending
phase: 2
order: 2
plan: plan-buck-loop-extension.md
phases_overview: plan-buck-loop-extension-phases.md
difficulty: hard
model_hint: strongest reasoning model available — resume safety depends on reconciling plan artifacts and a non-authoritative projection without false advancement
buck_hint: /b-build-hard
goal: "Scan existing Buck artifacts into the frozen snapshot contract and persist a projection that never overrides disk truth."
files:
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/persist.ts
  - extensions/buck-loop/__tests__/scan.test.ts
  - extensions/buck-loop/__tests__/persist.test.ts
from_plan_steps: [2]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] An explicit plan, phase, or subject path resolves to the correct existing plan and first incomplete phase without auto-planning or guessing among multiple subjects."
  - "[ ] The scan reports plan/phase completion, iterate artifacts, review documentation/how-to impact, git/postcondition facts, and safety reasons using Phase 1 snapshot types."
  - "[ ] `.context/workflow/buck-loop.json` round-trips versioned projection state without creating or reading an XState snapshot."
  - "[ ] Resume rescans artifacts before transition selection; stale `building` plus all phases completed resolves to `done`."
  - "[ ] Unsafe disagreements, including projection `done` with an incomplete phase or a vanished subject, resolve to `blocked` with a reason."
  - "[ ] Focused scan and persistence tests pass."
completed_at: null
completed_by: null
---

# Phase 2: Artifact State

## Context

Parent user goal: An operator can leave a well-scoped Buck plan running unattended through build → review → iterate-if-needed → docs-if-needed → save → commit → next phase, without XState. Every transition is either a deterministic disk/git check or a closed-set LLM choice the machine validates.

Phase 1 defines the semantic snapshot. This phase is the only filesystem reconciliation layer: Buck artifacts win over `.context/workflow/buck-loop.json`, which is only a resumable projection.

## Implementation Details

1. Create `scan.ts` to resolve an explicit plan, phase, or subject path. Support phased and non-phased plans. For phased work, select the first non-completed phase whose dependencies are satisfied; never create a plan or run `b-phase`.
2. Copy only useful predicates from `extensions/b-flow/scan-context` or guards when needed. Do not import `extensions/b-flow/**` and do not preserve XState-shaped data.
3. Scan authoritative facts needed by the table:
   - subject, plan, and active phase identity;
   - plan/phase completion status;
   - active `iterate-*.md` artifact;
   - review documentation/how-to impact when deterministically parseable;
   - changed-files / unchanged-phase ambiguity needed for postcondition decisions;
   - missing or ambiguous resolution reasons.
4. Create `persist.ts` for versioned reads and writes of `.context/workflow/buck-loop.json`. Preserve state, subject, plan/phase paths, loop counters, last accepted choice, and transition history.
5. Implement resume reconciliation:
   - read the projection;
   - rescan disk artifacts;
   - replace stale projection facts with scan facts;
   - allow stale `building` + all phases complete to become `done`;
   - block unsafe disagreement when a projection claims `done` but work is incomplete, or when its subject disappeared.
6. Add isolated temporary-repository fixtures for phased, non-phased, missing, ambiguous, stale, and unsafe resume cases. No live model or nested session.

## Risks

- Treating projection state as authoritative can skip unfinished work. Reconciliation must happen before `next()`.
- Regex-heavy review parsing can create false certainty. Return an ambiguous fact for Phase 3 rather than guessing.
- Reusing b-flow helpers by import would revive the deprecated runtime coupling. Copy and simplify only predicates justified by tests.
- Tests that depend on the working repository are nondeterministic. Use isolated temporary fixtures.

## Verification

- Run `vitest run extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/persist.test.ts`.
- Exercise both reconciliation directions: stale active projection with completed artifacts advances to `done`; unsafe completed projection with incomplete artifacts blocks.
- Confirm no `orchestration.snapshot.json` access and no import from `extensions/b-flow/`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the session resumes here next turn.
