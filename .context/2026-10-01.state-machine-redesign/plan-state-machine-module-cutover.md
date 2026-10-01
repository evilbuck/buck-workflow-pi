---
status: active
date: 2026-10-01
subject: 2026-10-01.state-machine-redesign
topics: [state-machine, buck-loop, code-review-iteration, refactor, cutover]
research: [research-buck-loop-mapping.md]
iterations:
  - iterate-module-finalization.md
memory: [state-machine-review-port-build-2026-10-01.md]
sql_memory_ids:
  - "01a0f787-76f9-7066-b52d-b5881d723178"
---

# Plan: Self-contained state machine module and full cutover

## User Goal

A developer (human or agent) can read a machine's states, edges, guards, effects, and operator-only moves in one place and add a new state without learning three rule kinds; buck-loop runs on it unchanged in behavior, and the module can be lifted into another project as-is.

## Goal

Replace `extensions/state-machine.ts` (rule-kind evaluator: `automatic` / `choices` / `events`, `advance` / `choose` / `send`) with the redesigned module in `extensions/state_machine/`, port both production consumers (`buckMachine`, `reviewMachine`) onto it with no behavior change, then delete the old engine and update every living doc. One engine before, one engine after (ADR 0002).

## Context used / assumptions

- **User decisions (this session):** graph as explicit `targets`; `initial` on the machine; `final: true` = legal end, may have targets; definition separate from instance (`start()` / `restore(name)`); target rows `{ name, guard?, effect?, manual? }`, one row per from→to pair; guards `(facts) => boolean`; effects returned as data from `transition()`, run by the caller, no pub/sub; "context" renamed "facts"; `available(facts)` replaces `automatic`/`choices`; operator actions are `manual` edges; STOP repeated per state via a consumer constant; full phased cutover; zero-import folder; exactly-one policy lives in each consumer adapter; site guide rewritten in the final phase.
- **Prototype:** `extensions/state_machine/index.ts` (implementation + transmission and loop examples; examples currently run at import time).
- **Research:** `research-buck-loop-mapping.md` (graph, ~110 rules → 36 edges, findings 1–7, deferred `includeManual`).
- **Code read:** `extensions/state-machine.ts`, `extensions/buck-loop/machine.ts`, `extensions/buck-loop/loop.ts` (`takeStep` blocks on any thrown `Error`, lines 389–400), `extensions/code-review-iteration/machine.ts`, `extensions/code-review-iteration/loop.ts:786–810`, `package.json` (only `extensions/index.ts` is a loader entry), `vite.config.ts`, `guardrails.json`.
- **Consumers of the old engine (complete list, grep):** `extensions/buck-loop/machine.ts`, `extensions/buck-loop/__tests__/machine.test.ts`, `extensions/code-review-iteration/machine.ts`, `extensions/code-review-iteration/loop.ts`, `extensions/code-review-iteration/__tests__/machine.test.ts`, `extensions/code-review-iteration/__tests__/loop-machine-failure.test.ts`, `extensions/state-machine.test.ts`. Docs: `docs/state-machine.md`, `docs/adr/0002-observably-invoked-happy-path-loop.md`, `docs/extension-loading.md`, `extensions/code-review-iteration/personas/correctness.md`, `site/guides/state-machine.html`, `site/index.html`. Historical (leave): `docs/brainstorms/b-orchestration-extension.md`, `presentations/buck-workflow-architecture.html`, `.context/**`.

## Decision Closure

- **Selected course:** finalize the module, port buck-loop, port code-review-iteration, delete the old engine, update docs — four sequential phases, each independently green and committed.
- **Key trade-offs accepted:** overlap between guards is no longer detected by the module; each adapter restores fail-closed behavior (review: exactly one available; buck: more than one only when facts say a decision is open). Multi-rule edges merge into one guard (OR) with an effect that re-derives the reason from facts.
- **Evidence:** user decisions above; research findings; `takeStep` converts any thrown `Error` into a blocked halt, so adapters may throw plain typed errors; `Choice` kinds and `lastChoice` are persisted in the buck snapshot (`types.ts:131–135,178`), so the buck `Choice` vocabulary stays at the adapter boundary.
- **Excluded scope:** see Out of scope.
- **Next action:** Phase 1 — split the prototype into a side-effect-free `index.ts` plus a runnable example, and add the module's behavior tests.

## Assumptions Ledger

| id | statement | status | blocking | evidence / validation_path |
|---|---|---|---|---|
| A-1 | The port changes no persisted buck-loop data (state names, `Choice` kinds, `lastChoice`, history `why` strings). | validated | false | Phase 2: required unchanged-file diffs are empty; unchanged loop/persist tests pass. Literal legacy fixtures and both-mode adapter comparisons preserve full outputs. See `build-phase-2.md`. |
| A-2 | Every buck choice set maps onto distinct targets per state (self = `retry`; `reviewing`: iterating/documenting/saving = iterate/document/save; any other non-self target = `advance`). | validated | false | `machine.ts:269–284,307–322,345–359,365–408,488–512`: no state offers two choices with one target; `committing`'s `advance` targets (building/done/blocked) are mutually exclusive by `planFacts.kind`. |
| A-3 | Every automatic-vs-choice wording difference on a shared edge is derivable from facts (`ambiguousChoiceOpen`, `reviewUnparseable`). | validated | false | Phase 2: 100 reachable former-rule fixtures pin literal `to`/`effect`/`why`; machine suite passes. Both-mode comparisons find no output or rejection differences. See `build-phase-2.md`. |
| A-4 | `loop.ts` needs no change for buck: it already halts on any `Error` from `next()`. | validated | false | `loop.ts:395–400`. |
| A-5 | No consumer of `extensions/state-machine.ts` exists beyond the list above. | validated | false | `rg` over the repo excluding `.context/**` and `node_modules/**`. Re-run before deletion in Phase 4. |
| A-6 | `reviewMachine` maps rule-for-edge (no multi-rule edges) except via self-loop `initializing → initializing`. | validated | false | Phase 3 pins all 13 legacy rule labels and complete outputs (source count corrected from 15); 129,600 old/new adapter calls match. See build-phase-3.md. |

## Material Risks

| failure_mode | impact | mitigation | rollback_or_fallback | validation_path |
|---|---|---|---|---|
| Buck routing drift (wrong stage, wrong `why`) | Unattended loop runs the wrong skill or blocks wrongly | Port truth table with identical expectations; `loop.test.ts` (1443 lines) unchanged and green; buck adapter throws on unexpected >1 | Revert the Phase 2 commit (touches only `buck-loop/machine.ts` + its test) | Phase 2 commit is separate; `npx vitest run extensions/buck-loop` on the reverted tree passes |
| In-flight saved buck run breaks after upgrade | Resume fails or misroutes | A-1: no persisted format change; vocabulary adapter | Same revert as above | `persist.test.ts` + resume scenarios in `loop.test.ts` pass unmodified |
| Self-edit hazard: executing Phases 2–3 under `/buck-loop` edits its own supervisor; `/reload` keeps imported modules | Loop runs stale or half-edited routing | Execute Phases 2–3 outside `/buck-loop`, or restart OMP after each | Restart OMP; rerun from last commit | Verify in a fresh process (`npx vitest run …`), not `/reload` |
| Review loop behavior drift | Review/fix loop exits with wrong status | Ported truth table + exclusivity sweep; `loop.test.ts` (24 scenarios) diff empty | Revert the Phase 3 commit | `git diff extensions/code-review-iteration/__tests__/loop.test.ts` empty; suite green |
| Coverage ratchet drop (baseline 84) when the old suite is deleted | Guardrails fail | Module behavior tests land in Phase 1, before deletion | Add module tests; never lower the baseline | `npm run guardrails:check` after Phases 1 and 4 |

## Light Grill

- Q1: Where does the "exactly one target, else error" policy live? → resolved: in each consumer adapter; module surface unchanged (recommended).
- Q2: Rewrite `site/guides/state-machine.html` + `site/index.html` in this plan? → resolved: yes, final phase (recommended).

## Scope

1. Module finalization in `extensions/state_machine/` (zero imports outside the folder, no Node/platform APIs, no top-level side effects, own tests and README).
2. Port `buckMachine` with `buck-loop/machine.ts`'s exported API unchanged.
3. Port `reviewMachine`; minimal `code-review-iteration/loop.ts` change (error type + adapter call).
4. Delete `extensions/state-machine.ts` and its test; update living docs and the site guide.

## Out of scope

- Behavior changes to either loop (any needed test-expectation edit beyond error type/imports = stop and re-plan).
- `available(facts, { includeManual: true })` (recorded as DEFERRED).
- Changing buck `Snapshot` / `types.ts`, `choice.ts`, `CONTINUATION_RUBRIC`, or persisted formats.
- A separate `package.json` / npm publishing for the module.
- Renaming the folder to kebab-case (user chose `state_machine`).
- Historical artifacts: `.context/**`, `presentations/**`, `docs/brainstorms/**`.

## Affected files

| Phase | Files |
|---|---|
| 1 | `extensions/state_machine/index.ts`, `extensions/state_machine/state_machine.test.ts` (new), `extensions/state_machine/README.md` (new), `extensions/state_machine/examples/transmission.ts` (new) |
| 2 | `extensions/buck-loop/machine.ts`, `extensions/buck-loop/__tests__/machine.test.ts` |
| 3 | `extensions/code-review-iteration/machine.ts`, `extensions/code-review-iteration/loop.ts`, `extensions/code-review-iteration/__tests__/machine.test.ts`, `extensions/code-review-iteration/__tests__/loop-machine-failure.test.ts` |
| 4 | delete `extensions/state-machine.ts`, `extensions/state-machine.test.ts`; `docs/state-machine.md`, `docs/adr/0002-observably-invoked-happy-path-loop.md`, `docs/extension-loading.md`, `extensions/code-review-iteration/personas/correctness.md`, `site/guides/state-machine.html`, `site/index.html` |

## Implementation steps

### Phase 1 — Module (`extensions/state_machine/`)

1. Make `index.ts` library-only: keep `defineMachine`, `MachineDefinition`, `MachineInstance`, `Transition`, `Guard`, `EffectOf`, `IllegalTransitionError`, `UnknownStateError`, `InvalidMachineError`; remove all example code so importing has no side effects. Keep the vocabulary header and the DEFERRED note on `available()`.
2. Move the transmission and cut-down loop examples to `examples/transmission.ts`, importing only `../index.js`; runnable with `bun extensions/state_machine/examples/transmission.ts`.
3. Add `state_machine.test.ts` (vitest; imports only `./index.js`) covering consumer-visible behavior: definition rejects unreachable / stuck / no-final / duplicate edge / undeclared target; `restore` rejects unknown names; `transition` rejects non-target (`not-a-target`) and failed guard (`guard-rejected`) leaving state unchanged; a throwing guard or effect leaves state unchanged; effect description is returned; `available` filters by guard and always excludes `manual`; a `manual` edge with a guard is enforced by `transition`; a final state with targets can still move; a facts-less machine calls `transition(to)`.
4. Write `README.md`: vocabulary, definition vs instance, caller policies for 1 / many / 0 available, effects-as-data, `manual` edges, restore from persisted name, error classes, DEFERRED `includeManual`. This is the canonical doc for the module.

### Phase 2 — Port `buckMachine`

5. Rewrite `extensions/buck-loop/machine.ts` over `../state_machine/index.js`. Exports stay `next`, `applyChoice`, `legalChoices`, `start`, `userConfirmed`, `stopFrom`, `limitsExceeded`, `MAX_ITERATE_CYCLES_PER_PHASE`, `BuckEvent`/`BuckOutput` as used. Graph per research table; `idle` initial; `done`, `aborted` final with `targets: []`.
6. Machine facts = `Snapshot & { sqlMemoryConfigured: boolean }`, built inside the adapter (replaces the `process.env.SQL_MEMORY_URL` read in a guard; no `Snapshot` change).
7. Multi-rule edges: one guard per edge (OR of former `when`s) plus reason functions (`blockReason`, `rerunReason`, …) that both the guard and the effect use, preserving every former `why` string verbatim.
8. Operator edges: `const STOP = { name: "aborted", manual: true }` spread into every non-final state; `idle → resolving` manual (START); `blocked → reviewing` / `blocked → resolving` manual with guards `completedBlockedWork` / its negation (USER_CONFIRMED).
9. Adapter policy in `next(s)`: `restore(s.state)`, `available(facts)`; one → transition (except the existing SQL-saving single-option choice boundary); more than one **and** a decision is open per facts (`ambiguousChoiceOpen` or `reviewUnparseable`) → `choose` effect with legal `Choice[]` mapped from targets (A-2 mapping); otherwise throw a typed error (message names state and targets). `applyChoice` maps `Choice` → target, validates it against `available`, transitions. `stopFrom` keeps the `done`/`aborted` special case.
10. Port `buck-loop/__tests__/machine.test.ts`: identical `to`/`effect`/`why` expectations; replace `MachineFailure` with the new error types; add a test that every non-final state has a manual edge to `aborted`.

### Phase 3 — Port `reviewMachine`

11. Rewrite `extensions/code-review-iteration/machine.ts`: edges per current rules (outputs unchanged, including `rule` labels); terminal states final with `targets: []`; `cancelled` reached by a `manual` edge from every non-final state (mirrors STOP; satisfies reachability and documents operator cancel).
12. Export an adapter `decide(facts)`: `restore(facts.state)`, `available(facts)`; exactly one → `{ to, output }`; otherwise throw `ReviewMachineError(code: "NO_ROUTE" | "AMBIGUOUS_ROUTE", context)`. `machineFailureReason` formats it as `review machine <code>: <context>`.
13. `code-review-iteration/loop.ts`: replace `reviewMachine.advance` + `decision.kind` check with `decide(facts)`; replace the `MachineFailure` import with `ReviewMachineError`.
14. Port `__tests__/machine.test.ts` (row layer + exclusivity sweep against `ReviewMachineError`) and `__tests__/loop-machine-failure.test.ts` (throw `ReviewMachineError("NO_ROUTE", …)`, report still contains `review machine NO_ROUTE`).

### Phase 4 — Delete and document

15. Re-run the A-5 consumer search; delete `extensions/state-machine.ts` and `extensions/state-machine.test.ts`.
16. Docs: ADR 0002 amendment (engine replaced by `extensions/state_machine/`; still one engine; supervisor still the only effect interpreter); `docs/state-machine.md` → short pointer to `extensions/state_machine/README.md`; `docs/extension-loading.md:168` path/wording; `personas/correctness.md` reference.
17. Rewrite `site/guides/state-machine.html` for the new API (same eight-step recipe shape, complete copyable files, exact expected output verified by running them) and update `site/index.html` links/wording.
18. Run `npm run guardrails:check`.

## Acceptance criteria

- [ ] `extensions/state_machine/**` has no import specifier that leaves the folder and no Node/platform API use; importing `index.ts` has no side effects.
- [ ] Module behavior tests pass and cover every item in step 3.
- [ ] `examples/transmission.ts` runs and prints the documented output.
- [x] `extensions/buck-loop/{loop,choice,types}.ts` diffs are empty; `buck-loop/__tests__/loop.test.ts` and `persist.test.ts` pass unmodified.
- [x] Ported buck truth table pins every former rule's `to`/`effect`/`why`; every non-final buck state has a manual `aborted` edge (tested).
- [ ] `code-review-iteration/__tests__/loop.test.ts` diff empty and green; exclusivity sweep green against `ReviewMachineError`.
- [ ] `extensions/state-machine.ts` and its test are deleted; repo search (excluding historical paths) finds no reference to `state-machine.ts` / `../state-machine.js`.
- [ ] ADR 0002, `docs/state-machine.md`, `docs/extension-loading.md`, `personas/correctness.md`, `site/guides/state-machine.html`, `site/index.html` describe the new module only.
- [ ] `npx tsc --noEmit -p .` clean; `npm test` green; `npm run guardrails:check` passes (coverage ≥ baseline, no CCN > 10 in new code).

## Verification

- Per phase: `npx tsc --noEmit -p .` and the phase's focused suites (`npx vitest run extensions/state_machine`, `… extensions/buck-loop`, `… extensions/code-review-iteration`).
- Self-containment: `rg -n "from ['\"]" extensions/state_machine` shows only `./` / `../index.js` specifiers inside the folder; `rg -n "process\.|node:|Bun\." extensions/state_machine` empty.
- Equivalence: `git diff --stat` on the unchanged-file lists above is empty after Phases 2 and 3.
- Smoke: `bun extensions/state_machine/examples/transmission.ts`; run the rewritten site guide's files and compare against the printed expected output; serve `site/` (`npm run site:serve`) and check the guide page renders.
- Final: `npm test`, `npm run guardrails:check`.

## Execution Instructions

This plan exceeds the single-unit thresholds (18 steps, >5 files, two consumers). Phase it with `/skill:b-phase` before building. Run Phases 2–3 outside `/buck-loop` (or restart OMP after each) because they edit the loop's own routing.

## Risks

See Material Risks. Additional low-severity: folder name `state_machine` differs from the repo's kebab-case directories (user choice, accepted).
