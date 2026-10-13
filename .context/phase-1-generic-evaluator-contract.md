---
status: completed
completed_at: 2026-09-20
phase: 1
order: 1
plan: plan-reusable-state-machine.md
phases_overview: plan-reusable-state-machine-phases.md
difficulty: medium
model_hint: capable general model preferred — the API is small, but fail-closed rule semantics and TypeScript generics require careful cross-file reasoning
buck_hint: /b-build
goal: "Define and prove the domain-neutral synchronous evaluator contract before any Buck caller migrates."
files:
  - extensions/state-machine.ts
  - extensions/state-machine.test.ts
from_plan_steps: [1, 2]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] `extensions/state-machine.ts` imports no Buck module, Node/platform module, OMP SDK, XState, filesystem, git, process, clock, or async host dependency."
  - "[x] The public operational interface is limited to machine definition plus `advance`, `choose`, and `send`."
  - "[x] Automatic rules fail on ambiguity and no-route cases rather than using declaration order or a fallback edge."
  - "[x] Legal choices are derived from the same rules that `choose()` revalidates; stale and forged choices fail closed."
  - "[x] External events and transition targets are validated, including invalid terminal/event paths."
  - "[x] A non-Buck fixture proves automatic, choice, event, typed-failure, and domain-generic output behavior through the public interface."
---

# Phase 1: Generic Evaluator Contract

## Context

Parent user goal: Extension authors can define and test deterministic, fail-closed state machines without rebuilding dispatch and closed-choice validation, while `/buck-loop` keeps its current behavior.

This phase establishes the reusable seam without changing `/buck-loop`. It front-loads the main architecture risk: whether a compact, pure interface can own dispatch and validation without absorbing orchestration policy.

## Implementation Details

1. Re-read current `extensions/buck-loop/types.ts`, `table.ts`, `loop.ts`, and Buck table tests as a behavioral inventory. Record every edge category the generic contract must represent: automatic rules, closed choices, external/operator events, target validation, ambiguity, no route, and illegal/stale input. Do not edit Buck files in this phase.

2. Create failing contract tests in `extensions/state-machine.test.ts` for:
   - exactly one enabled automatic rule;
   - multiple enabled automatic rules;
   - no valid automatic route;
   - derived legal choice sets;
   - valid choice application;
   - stale, forged, and disabled choices;
   - valid external events;
   - unknown or invalid terminal events;
   - missing states and invalid targets;
   - opaque, domain-generic outputs.

3. Include a small non-Buck fixture in the core test file. It must exercise automatic, closed-choice, and external-event paths without importing `extensions/buck-loop/**`.

4. Implement `defineMachine()` and its compiled `advance`, `choose`, and `send` operations in `extensions/state-machine.ts`. Keep state lookup, enabled-rule evaluation, target validation, ambiguity detection, legal-choice derivation, and choice revalidation internal.

5. Return typed failures with enough structured context for a supervisor to create a useful durable block reason. Do not add effect execution, persistence hooks, async callbacks, clocks, retries, hierarchy, actors, subscriptions, or platform imports.

6. Keep automatic-rule precedence explicit: evaluate the enabled set and reject cardinality greater than one. The core must never treat declaration order as priority.

## Risks

- **Shallow abstraction:** if consumers still implement dispatch or maintain a separate legal-choice list, the core is only a renamed reducer. Keep those invariants inside the compiled machine.
- **Framework creep:** helper callbacks can become an async runtime. Reject host concerns and convenience hooks without a second demonstrated consumer.
- **Type complexity:** generic types can leak implementation detail or make common definitions unreadable. Prefer the smallest types that preserve closed choices and typed outputs.
- **False independence:** a Buck-shaped fixture would not prove reuse. Use unrelated names, facts, choices, events, and outputs.

## Verification

- `npx vitest run extensions/state-machine.test.ts`
- Inspect `extensions/state-machine.ts` imports and public exports: only the definition API and `advance` / `choose` / `send` operational surface are present.
- Confirm the non-Buck fixture imports no Buck module and reaches automatic, choice, external-event, and failure paths.
- Confirm no `extensions/buck-loop/**` file changed in this phase.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
