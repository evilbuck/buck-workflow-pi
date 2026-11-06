---
status: active
date: 2026-10-01
informs: [plan-state-machine-module-cutover.md]
---

# Mapping buckMachine onto the redesigned state machine

Prototype: `extensions/state_machine/index.ts`. Current consumer: `extensions/buck-loop/machine.ts` (`buckMachine`).

## Design so far (agreed in conversation)

- `defineMachine<Facts, Effect>()({ initial, states })` → definition; `start()` / `restore(name)` → instance.
- `targets: [{ name, guard?, effect? }]` — one row per from→to pair (join table), at most one guard.
- `final: true` = a legal end; may still have targets. `targets: []` = nothing leaves.
- Guard: `(facts) => boolean`. Effect: `(facts) => Effect`, returned from `transition()`, run by the caller. No pub/sub.
- `available(facts)` = targets whose guard passes. 1 → take it (was `automatic`); >1 → outside pick (was `choices`); 0 → was `NO_ROUTE`.
- "context" renamed "facts".

## Graph

initial `idle`; final `done`, `aborted` (`targets: []`).

| From | Targets |
|---|---|
| idle | resolving, aborted |
| resolving | building, blocked, done, aborted |
| building / iterating | self, reviewing, blocked, aborted |
| reviewing | self, iterating, documenting, saving, blocked, aborted |
| documenting | self, saving, blocked, aborted |
| saving | self, committing, blocked, aborted |
| committing | self, building, done, blocked, aborted |
| blocked | reviewing, resolving, aborted |

~110 rules collapse to 36 edges.

## Findings

1. **Many rules per edge.** e.g. `building → blocked` is 7 rules (loop limit ×3, iterate limit, failed again, ambiguous exhausted, postcondition missing), each with its own `why`. One row means guard = OR of conditions and the effect must re-derive which reason applies. Pattern: one `blockReason(facts): string | null`; guard `blockReason(f) !== null`, effect `blocked(blockReason(f)!)`. Self-loops are the same (`session pending` / `retry` / `choice retry` → one `building → building` row).
2. **Choices still fall out of count.** Guards are exclusive by construction: session pending → [self]; confirmed → [reviewing]; ambiguous → [self, reviewing] → Jev. Matches current behaviour.
3. **Choice labels change.** Jev today picks semantic kinds (`retry`, `advance`, `iterate`, `document`, `save`). With targets it picks state names; `retry` = self-loop. `committing`'s `advance` maps to building/done/blocked by plan facts, which still yields one target at a time. Needs an adapter in `loop.ts` (`deps.choose({ legal })`).
4. **Events → `manual` edges (decided).** START/STOP/USER_CONFIRMED are operator calls in their own code paths (`loop.ts:233,264,323,860`), not tick decisions. `{ name, manual: true, guard? }` hides them from `available()`; `transition()` takes them when named. Chosen over "commands as facts" because `manual` is inspectable data (statically testable: every edge into `aborted` is manual), guards stay single-purpose, and no `command` fact can leak through persistence into an unattended tick.
   **STOP repetition (decided):** keep an explicit `aborted` row on every non-final state via a consumer constant (`const STOP = { name: "aborted", manual: true } as const`, spread into each `targets`). No machine-level "from any state" edge: it would be a second declaration path and break "a state's `targets` shows every way out". Guard with a test: every non-final state has a manual edge to `aborted`.
5. **Instance lifetime = one tick.** The loop rebuilds `Snapshot` per tick: `restore(snapshot.state)` then `available(snapshot)`. Confirms definition/hydration split.
6. **Impure guard.** `saving-choice-advance` reads `process.env.SQL_MEMORY_URL`; should become a fact.
7. **Replaced helpers.** `legalChoices` (fake query that swallows failures) → `available()`. Rule ids disappear; `from->to` identifies an edge, `why` carries the reason.

## Deferred

- **Operator options for a UI.** `available()` hides `manual` edges, so a UI cannot list what the operator may do. If needed, add an opt-in `available(facts, { includeManual: true })`; the default must keep excluding manual edges so the tick can never take one. Marked `DEFERRED` on `available()` in `extensions/state_machine/index.ts`.
