---
status: pending
phase: 3
order: 3
plan: plan-reusable-state-machine.md
phases_overview: plan-reusable-state-machine-phases.md
difficulty: medium
model_hint: capable general model preferred — documentation must match the landed seam and verification spans core, Buck, LSP, smoke, and guardrails evidence
buck_hint: /b-build
goal: "Document the evaluator/adapter boundary and prove the complete migration through focused, end-to-end, and deterministic checks."
files:
  - docs/adr/0002-observably-invoked-happy-path-loop.md
  - docs/extension-loading.md
  - docs/buck-workflow.md
from_plan_steps: [7, 8]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] ADR 0002 records the internal pure evaluator seam without reversing the rejection of XState or a generic async orchestration runtime."
  - "[ ] Extension documentation describes a Buck definition over a pure evaluator rather than a reusable Buck transition table."
  - "[ ] Focused core/migration tests and the full Buck-loop suite pass."
  - "[ ] `npm run guardrails:check` returns a passing durable-contract verdict."
  - "[ ] LSP and repository search show no caller, alias, re-export, or dead comment for the deleted legacy table interface."
  - "[ ] A throwaway non-Buck import smoke exercises automatic, choice, stale-choice rejection, and external-event paths; the script is deleted after the run."
  - "[ ] The final diff preserves current chooser, loop, hook, and guardrail behavior, leaves `extensions/b-flow/**` untouched, and adds no dependency."
completed_at: null
completed_by: null
---

# Phase 3: Architecture Documentation and Proof

## Context

Parent user goal: Extension authors can define and test deterministic, fail-closed state machines without rebuilding dispatch and closed-choice validation, while `/buck-loop` keeps its current behavior.

Phases 1 and 2 establish the code seam. This phase makes the architecture durable for future agents and performs the complete proof before the parent plan can close.

## Implementation Details

1. Update `docs/adr/0002-observably-invoked-happy-path-loop.md` to record the final boundary:
   - an internal synchronous evaluator owns dispatch and fail-closed validation;
   - Buck owns the workflow definition and all supervision;
   - the change does not introduce or endorse XState, actors, async orchestration, generic persistence, or a reusable effect runner;
   - the prior `b-flow` deprecation remains intact.

2. Update `docs/extension-loading.md` and `docs/buck-workflow.md` where they describe the old pure Buck transition table. Name the landed shape precisely: a Buck-specific definition over a domain-neutral pure evaluator, interpreted by the Buck supervisor.

3. Run focused core and migration tests, then the complete Buck-loop suite. Any failure is in-plan until the code satisfies the preserved behavior contract; fix through `/b-iterate` and repeat review rather than weakening tests.

4. Use LSP/repository search to prove that removed `table.ts` exports have no caller, alias, re-export, or obsolete comment. Confirm the only module combining generic rules with Buck vocabulary is `extensions/buck-loop/machine.ts`.

5. Create a throwaway TypeScript smoke outside permanent source. Import `defineMachine` from `extensions/state-machine.ts`; define an unrelated approval-style machine; exercise automatic, legal choice, stale/illegal choice rejection, and external event paths. Run it, capture the result in session evidence, then delete the script.

6. Run the durable guardrails contract. Do not weaken a gate, baseline, test, lint rule, or complexity threshold to obtain a pass.

7. Review the final changed-path set: no `extensions/b-flow/**`, dependency manifest, or lockfile change; current chooser, loop, hook, and guardrail behavior from commit `478dc6b` and later compatible work remains present.

## Risks

- **Documentation inversion:** calling the core an orchestration runtime would reverse the architecture decision. Describe decision evaluation only.
- **False-green smoke:** importing only types or exercising only a happy path would not prove the operational interface. Run all three operations plus stale-choice rejection.
- **Residual compatibility path:** a dead alias or re-export can keep the old convention alive. Check symbols and text after deletion.
- **Verification residue:** throwaway scripts are not product code. Remove them before save/commit and verify the cleanup.
- **Concurrent baseline loss:** final diff review must catch accidental removal of later chooser, lifecycle, or guardrail work.

## Verification

- `npx vitest run extensions/state-machine.test.ts extensions/buck-loop/__tests__/machine.test.ts extensions/buck-loop/__tests__/loop.test.ts extensions/buck-loop/__tests__/persist.test.ts`
- `npx vitest run extensions/buck-loop/__tests__`
- `npm run guardrails:check`
- LSP/repository search: zero remaining legacy table callers, aliases, re-exports, or dead comments.
- Throwaway non-Buck import smoke passes automatic, choice, stale-choice rejection, and external-event paths; its file is absent afterward.
- Final changed paths exclude `extensions/b-flow/**`, dependency manifests, and lockfiles.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
