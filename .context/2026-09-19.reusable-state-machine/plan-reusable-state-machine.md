---
status: completed
date: 2026-09-19
subject: 2026-09-19.reusable-state-machine
topics: [state-machine, extensions, buck-loop, architecture, refactor]
research: []
iterations:
  - iterate-reusable-state-machine.md
memory:
  - reusable-state-machine-phasing-2026-09-19.md
  - reusable-state-machine-phase-1-build-2026-09-20.md
  - reusable-state-machine-phase-2-iterate-2026-09-20.md
  - reusable-state-machine-phase-2-save-2026-09-20.md
  - reusable-state-machine-phase-3-build-2026-09-20.md
---

# Plan: Extract a reusable pure state-machine evaluator

## User Goal

Extension authors can define and test deterministic, fail-closed state machines without rebuilding dispatch and closed-choice validation, while `/buck-loop` keeps its current behavior.

## Goal

Extract the domain-neutral decision machinery from `extensions/buck-loop/` into a small reusable TypeScript module. Keep Buck workflow facts, states, guards, effects, persistence, scanning, model calls, and effect execution in a Buck-specific definition and supervisor.

The reusable seam is the pure decision evaluator, not an asynchronous orchestration runtime.

## Validated current state

- **Confirmed:** `extensions/buck-loop/table.ts` is pure and deterministic. It imports only Buck types and performs no filesystem, git, process, clock, model, or OMP SDK work (`table.ts:1-16`, `table.test.ts:401-424`).
- **Confirmed:** `next(snapshot)` and `applyChoice(choice, snapshot)` return data-only transitions; `loop.ts` interprets their effects and owns persistence, nested sessions, rescans, timestamps, and durable blocking (`loop.ts:255-350`, `loop.ts:550-641`).
- **Confirmed:** the table is tightly coupled to Buck business policy. `LoopState`, `PlanFacts`, `ReviewFacts`, `WorkSkill`, `Choice`, and `Effect` encode the build → review → iterate/docs → save → commit workflow (`types.ts:35-209`); the table hard-codes that graph, its retry policy, review priority, and safety ceilings (`table.ts:24-332`).
- **Correction to the earlier assessment:** the current `Snapshot` / `Transition` / `Effect` exports are not reusable interfaces; only their architectural pattern is reusable. Their vocabulary is Buck-specific.
- **Correction to the earlier assessment:** replacing the domain is not a `table.ts` + `types.ts` edit with no ripple. `loop.ts` switches on concrete states and skills, `persist.ts` validates concrete state/choice enums, `scan.ts` constructs Buck facts, and `choice.ts` serializes Buck choices. Reusing the current machine directly would require changes across those modules.
- **Original design constraint:** Phase 1 intentionally warned that over-generalizing effects would create another orchestration framework. This plan keeps that protection: no XState-like actors, async runtime, persistence abstraction, or effect executor enters the reusable core.

## Interface decision

### Alternative A — callback reducer

Expose `decide(snapshot, event)` and let each consumer provide the entire callback. This has the smallest surface, but it is shallow: dispatch, ambiguity detection, legal-choice derivation, and stale-choice validation remain consumer responsibilities.

**Rejected:** it renames the current table without creating reusable behavior.

### Alternative B — declarative pure evaluator

Define flat states with pure automatic rules, closed choice rules, and explicit external-event rules. The compiled machine owns state lookup, enabled-rule evaluation, ambiguity detection, legal-choice derivation, stale/illegal choice rejection, and target validation. Domain outputs remain opaque to the core.

Representative interface shape:

```ts
const machine = defineMachine<State, Facts, Choice, Event, Output>({
  stateOf: (facts) => facts.state,
  states: {
    /* automatic, choices, and events */
  },
});

machine.advance(facts);              // deterministic transition or enabled choices
machine.choose(facts, choice);       // revalidates and applies one enabled choice
machine.send(facts, externalEvent);  // operator-owned edge
```

**Chosen:** it is deep enough to remove duplicated machinery while keeping the interface to three operations and all business meaning in the adapter.

### Alternative C — generic async supervisor

Generalize effect handlers, persistence, retries, cancellation, clocks, and resume behavior behind one runner.

**Rejected:** those semantics differ by workflow and host. The resulting interface would either expose many policy knobs or silently impose Buck behavior on unrelated consumers. It would recreate the over-engineered orchestration layer this repository already deprecated.

## Core invariants

- Flat states only. No hierarchy, parallel regions, delayed events, actor spawning, context mutation, or subscriptions.
- Pure and synchronous. No Node platform imports, OMP SDK, promises, clocks, filesystem, git, or process access.
- Automatic rules are evaluated as a set. More than one enabled automatic transition is an error, not declaration-order priority.
- Buck priority remains explicit through mutually exclusive Buck guards: iterate; else docs/how-to; else clean save.
- Enabled choices are derived from the same rules used to apply choices. `choose()` re-evaluates eligibility so stale or forged choices fail closed.
- Missing state definitions, unknown targets/events, no valid route, illegal choices, and ambiguous automatic rules produce typed failures. The Buck supervisor converts them to its existing durable `blocked` state.
- The core returns generic outputs; it never interprets `run-skill`, `choose`, `await-operator`, or any future consumer's effects.

## Context used / assumptions

- User-provided context: validate the current decoupling claims, then plan to make the state machine reusable.
- Session context: current source, original buck-loop plan and Phase 1 contract, ADR 0002, project module-design guidance, and four independent interface sketches.
- Capability probe: full Buck Workflow; `b-build`, `b-review`, and `b-save` are present in the system available-skills catalog.
- No research artifact was required; this is an internal architecture refactor grounded in current code.
- Scope assumption: “reusable” means an internal module importable by other repository extensions, not a separately versioned public package.
- Concurrent buck-loop and guardrail edits landed in commit `478dc6b` immediately before this plan commit. Implementation must re-read current HEAD and preserve that baseline; it must not reset or reconstruct the pre-commit tree.
- `.context/backlog/items/buck-loop-contextless-choice-stall.md` overlaps `scan.ts`, `choice.ts`, `loop.ts`, and tests. Its tracker status remains authoritative; this refactor must preserve the current behavior and any later follow-up.

## Scope

- Add one domain-neutral pure evaluator under `extensions/`.
- Express the current Buck transition graph as a Buck-specific machine definition backed by that evaluator.
- Migrate every Buck caller to the new machine interface and remove the old table interface cleanly.
- Preserve all observable Buck transitions, choice sets, safety limits, retry behavior, block behavior, reasons useful for operations, and artifact-wins supervision.
- Prove domain independence with core contract tests and a small non-Buck machine fixture.
- Update the architecture decision and extension documentation to describe the new seam without weakening the no-XState decision.

## Out of scope

- A reusable effect runner, persistence layer, scanner, model chooser, audit writer, retry engine, or async supervisor.
- Changing the `/buck-loop` state graph, command surface, work-skill mapping, counters, retry ceilings, review priority, or choice policy.
- Fixing the separate context-free chooser stall; only preserve compatible concurrent changes.
- Migrating `code-review-iteration`, the unwired tmux status machine, `b-grill-auto`, or deprecated `b-flow` to the new core.
- Reviving `extensions/b-flow/`, adding XState, or adding another runtime dependency.
- Publishing the evaluator as a standalone npm package.

## Affected files

### Create

- `extensions/state-machine.ts` — generic types, definition validation, automatic decision evaluation, closed-choice derivation/application, and external-event dispatch.
- `extensions/state-machine.test.ts` — domain-neutral contract tests, including an unrelated fixture machine.
- `extensions/buck-loop/machine.ts` — Buck-only guards, actions/outputs, state declarations, and machine instance.
- `extensions/buck-loop/__tests__/machine.test.ts` — migrated Buck truth table and policy tests.

### Edit

- `extensions/buck-loop/types.ts` — retain Buck vocabulary; use generic core types only where they reduce duplication without exposing core implementation details.
- `extensions/buck-loop/loop.ts` — call the compiled machine for automatic, closed-choice, and operator-event decisions; keep all I/O and effect execution here.
- `extensions/buck-loop/index.ts` — update module map/comments if they name `table.ts`.
- Other buck-loop tests importing legacy table exports — migrate to the machine interface while preserving behavioral assertions.
- `docs/adr/0002-observably-invoked-happy-path-loop.md` — record that the hand-rolled Buck definition uses an internal pure evaluator, while the rejected generic async/FSM runtime decision still stands.
- `docs/extension-loading.md` and `docs/buck-workflow.md` — replace “pure transition table” wording with “Buck definition over a pure evaluator” where needed.

### Delete

- `extensions/buck-loop/table.ts` — no compatibility wrapper or deprecated alias.
- `extensions/buck-loop/__tests__/table.test.ts` — replace with behavior-level core and Buck-machine tests; do not retain source-text import assertions.

## Implementation steps

1. **Freeze the behavioral contract.** Re-read the current working-tree versions of `types.ts`, `table.ts`, `loop.ts`, and all buck-loop tests. Enumerate every automatic edge, operator edge, legal choice set, safety gate, retry gate, and fail-closed branch. Treat current behavior plus the context-free chooser work as the migration contract.
2. **Add the generic evaluator test-first.** Create failing tests for: one enabled automatic rule; multiple enabled automatic rules; no route; derived choice sets; stale/illegal choice rejection; valid external events; invalid/terminal events; invalid targets; and domain-generic outputs. Implement `defineMachine()` plus `advance`, `choose`, and `send` without platform imports.
3. **Create the Buck definition.** Move Buck transition policy into named pure guards and outputs in `buck-loop/machine.ts`. Make priorities mutually exclusive instead of relying on rule order. Keep loop and iterate limits in Buck guards so terminal `done` transitions remain ungated exactly as today.
4. **Cut callers over.** Use LSP references for every exported symbol from `table.ts`; migrate `loop.ts`, tests, and comments to the compiled machine. Route START, USER_CONFIRMED, and STOP through explicit machine events. Remove `table.ts` and its exports after the last caller moves.
5. **Preserve supervisor ownership.** Keep scanning, persistence, history timestamps, counter updates, choice-model calls, nested work sessions, effect execution, and error-to-durable-block handling in `loop.ts` and existing adapters. Do not add these as evaluator hooks.
6. **Replace implementation-pinning tests.** Port the existing transition truth table to `machine.test.ts`, but delete the regex/source-text purity checks. Core tests should assert observable decisions and typed failures. Add a non-Buck fixture that exercises automatic, choice, and event paths through the same public interface.
7. **Update living architecture docs.** Amend ADR 0002 and the two extension catalog descriptions. State explicitly that this is an internal pure evaluator, not a replacement orchestration framework and not a reversal of the `b-flow` deprecation.
8. **Run migration and end-to-end verification.** Run focused core/Buck tests, all buck-loop tests, the durable guardrails contract, and a throwaway non-Buck import smoke. Remove the throwaway file before closeout.

## Acceptance criteria

- [ ] `extensions/state-machine.ts` imports no Buck module, Node/platform module, OMP SDK, XState, filesystem, git, process, clock, or async host dependency.
- [ ] Its public operational interface is limited to machine definition plus `advance`, `choose`, and `send`; state lookup, target validation, ambiguity detection, and choice validation stay internal.
- [ ] A non-Buck fixture uses the evaluator without importing `extensions/buck-loop/**` and proves automatic, choice, and external-event paths.
- [ ] `extensions/buck-loop/machine.ts` is the only module that combines generic evaluator rules with `LoopState`, `PlanFacts`, `ReviewFacts`, `WorkSkill`, Buck choices, and Buck effects.
- [ ] All existing Buck transitions remain behaviorally identical: deterministic guards win; iterate > docs/how-to > save; one retry; loop/iterate ceilings block before more work or choice; completion remains ungated.
- [ ] Legal choices are derived and revalidated from one rule declaration; no separate legal array plus application switch can drift.
- [ ] Ambiguous/no-route/illegal machine decisions fail closed and are persisted by the Buck supervisor as `blocked` with a useful reason.
- [ ] `loop.ts` remains the sole effect interpreter. The reusable evaluator cannot run skills, call models, scan artifacts, persist state, or read time.
- [ ] Every legacy `table.ts` caller is migrated; `table.ts`, its test, aliases, re-exports, and dead comments are removed.
- [ ] `extensions/b-flow/**` remains untouched and unwired; no new dependency is added.
- [ ] ADR 0002 and extension docs accurately describe the evaluator/adapter seam.
- [ ] Focused tests and `npm run guardrails:check` pass.

## Verification

- `npx vitest run extensions/state-machine.test.ts extensions/buck-loop/__tests__/machine.test.ts extensions/buck-loop/__tests__/loop.test.ts extensions/buck-loop/__tests__/persist.test.ts`
- `npx vitest run extensions/buck-loop/__tests__`
- `npm run guardrails:check`
- LSP references for every removed `table.ts` export show no remaining callers.
- Throwaway smoke: import `defineMachine` from `extensions/state-machine.ts`, define a small non-Buck approval machine, and exercise automatic, choice, stale-choice rejection, and operator-event paths. Delete the script after the run.
- Confirm the migration baseline includes commit `478dc6b` and retains its chooser, loop, hook, and guardrail behavior.

## Risks

- **Framework creep:** a guard/action DSL can grow into another XState. Keep the explicit feature exclusions in Core invariants and reject convenience features without a second demonstrated consumer.
- **False reuse:** Buck is initially the only production adapter. The independent fixture proves technical domain independence, not demand from a second production workflow. Do not force an unrelated live extension onto the seam merely to manufacture reuse.
- **Priority regression:** converting ordered imperative checks into declarative rules can enable two edges simultaneously. Evaluate all automatic rules and fail on ambiguity; encode Buck precedence with mutually exclusive guards.
- **Operational drift:** reason strings and block conversion feed persisted history and status output. Test meaningful reasons and the durable blocked path, not exact incidental wording.
- **Moving baseline:** buck-loop and guardrail work landed concurrently as `478dc6b`. Start implementation from refreshed source and LSP references; never reconstruct older file contents from this plan.

## Recommended next step

This plan exceeds the b-plan phasing threshold: it touches more than five files and changes a load-bearing seam while preserving a live state graph. Run `/skill:b-phase` to split it into sequential core-contract, Buck-migration, and documentation/verification phases before implementation.
