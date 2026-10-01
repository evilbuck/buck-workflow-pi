---
status: draft
date: 2026-09-28
subject: 2026-09-28.buck-loop-transition-guard
topics: [state-machine, buck-loop, jev, choice, guard]
informs: []
---

# Research: Transition guard before buck-loop routing

## Question

Can a decision point — a guard — sit before a state-machine transition and change the route, with Jev choosing among legal next states from the just-finished phase's output?

Initial use case: `/buck-loop` finishes `b-build`. The guard reads that build's output and picks the next state.

Brainstorm only. No implementation decision is locked.

## Conclusion

**Do not add a new rule kind to `extensions/state-machine.ts`.** The pause-and-pick mechanism already exists: `choices` in the evaluator, resolved by `extensions/buck-loop/choice.ts` via Jev.

The gap is policy and context, not a missing primitive:

1. After a confirmed build, routing is automatic (`building` → `reviewing`). Jev is only consulted when the postcondition scan is ambiguous.
2. The string Jev sees does not include build output. `Snapshot` has no last-session output fact.

Recommended shape, if this proceeds: **guard = choice rules**, gated by a snapshot flag, with choices named as target states and a deterministic session summary added to the Jev state string. Not decided.

## How routing works today

The evaluator (`extensions/state-machine.ts`) is synchronous and pure. It owns no state between calls. Consumers own facts; the machine only selects one valid route or throws `MachineFailure`. It never calls a model.

Three rule kinds:

| Kind | Fires when | Operation |
|---|---|---|
| `automatic` | `when(facts)` is true | `advance` returns `{ kind: "transition" }` |
| `choices` | no automatic rule is enabled | `advance` returns `{ kind: "choices", choices }`; `choose` consumes a pick |
| `events` | an external signal is pushed | `send` |

Fail-closed: overlapping automatic rules throw `AMBIGUOUS_AUTOMATIC`; an automatic rule plus enabled choices throws `AMBIGUOUS_ROUTE`; an unknown or stale pick throws `ILLEGAL_CHOICE`. Targets must be declared states (`INVALID_TARGET`). Choice objects are deep-cloned; functions are rejected.

`extensions/buck-loop/machine.ts` is the consumer. `next()` calls `advance`. `fromDecision()` turns a `choices` result into `{ effect: { kind: "choose", legal } }` and stays in the current state. `applyChoice()` feeds the pick back through `choose()`.

`extensions/buck-loop/loop.ts` executes effects. A `choose` effect calls `choice.ts` `choose()`, then `applyChosen()`.

`choice.ts` asks Jev one choice question whose criteria are the legal labels (`runJev` / TypeSafe `systemOne`, not a chat session). Fewer than two continuations cannot form a question. A Jev miss falls through to the choice-stage profile model (two attempts), then `blocked`. It never default-advances. Each attempt is appended under `.context/<subject>/transition-audits/`.

That already matches the locked convention: a bounded decision is a Jev choice question, called from the extension, not wrapped in `runOmpModelSession`.

## Where the use case does not fit

`buildingLike()` in `extensions/buck-loop/machine.ts` only offers choices when `postconditionAmbiguous`. A confirmed build hits automatic rule `building-confirmed-review` and goes to `reviewing` with no judgment.

`decisionContext()` in `extensions/buck-loop/loop.ts` passes one line: state, phase path, why, review-fact summary, postcondition. `WorkFacts` is `sessionOutcome`, `retriesUsed`, `postcondition`. There is no last-session output on `Snapshot`.

Current choice labels are action verbs (`retry`, `advance`, `iterate`, `document`, `save`, `block`), not state names. The same verb can target different states depending on facts (see `committingChoices()`).

`fromDecision()` hardcodes `why` to either "review report unparseable; no iterate artifact" or "postcondition scan ambiguous". A guard that fires for other reasons needs a different why.

## Options

| Option | Shape | Why / why not |
|---|---|---|
| **A. Guard = choice rules** | Replace or gate the confirmed-build automatic edge with choice rules. A snapshot flag (`always` / `ambiguous` / `never`) keeps the automatic rule and the choice rules mutually exclusive, so `AMBIGUOUS_ROUTE` does not fire. | No evaluator change. Jev still cannot invent states. Costs one Jev call per guarded boundary. **Recommended if this proceeds.** |
| B. New `guard` rule kind in `state-machine.ts` | Fourth rule that pauses before an automatic transition for an external re-decision. | Duplicates `choices`. The evaluator cannot host the async Jev call and stay pure. |
| C. Post-advance interceptor in `loop.ts` | Automatic rule proposes `reviewing`; Jev may veto or redirect before the effect runs. | Routing leaves the declared table. Mutual exclusion and the audit record ("legal set offered, pick accepted") do not cover overrides. |

Under A, one naming choice is still open: keep action-verb labels, or key criteria by target state (`reviewing`, `iterating`, `documenting`, …). State names match the requested "list of available states". `Choice` can already carry a structured, cloneable payload, so a per-route rationale can ride along. That is a rubric and declaration change (`CONTINUATION_RUBRIC` in `choice.ts`), not a new mechanism.

## What a later plan would have to include

1. A new snapshot fact for the last session output, filled by the disk rescan in `loop.ts`. Artifacts win over what the child claimed. Distill deterministically; do not ask a model to summarize before Jev judges.
2. Extend `decisionContext()` so that summary is the Jev `state` string.
3. Guard-gated rules in `buildingLike()`, and in other work states only if scope expands.
4. A non-hardcoded `why` in `fromDecision()`.
5. Tests through the existing `deps.choose` seam. CI must not call a live model.

Fallback chain today: Jev → profile model (2 attempts) → `blocked`. Whether a guard keeps that chain or is Jev-only is undecided.

## Open questions

1. Guard only after build, or at every work-state boundary (review, docs, save, commit)?
2. Always guard a confirmed build, or only when the scan is ambiguous / signals are rich?
3. Choice labels: action verbs, or target state names?
4. Fallback: keep profile-model fallback, or fail closed on Jev alone?
5. How much build output is in the Jev state string: test results, error excerpts, changed files, or a bounded transcript slice?

## Evidence

- `extensions/state-machine.ts` — `advance` / `choose` / `send`; `AMBIGUOUS_ROUTE`, `ILLEGAL_CHOICE`, `INVALID_TARGET`.
- `extensions/buck-loop/machine.ts` — `buildingLike()`, `reviewingChoices()`, `committingChoices()`, `fromDecision()`, `applyChoice()`.
- `extensions/buck-loop/choice.ts` — `askJev()`, `CONTINUATION_RUBRIC`, audit writer.
- `extensions/buck-loop/loop.ts` — `runChoice()`, `applyChosen()`, `decisionContext()`.
- `extensions/buck-loop/types.ts` — `Choice`, `WorkFacts`, `Effect` (`choose` | `run-skill` | `await-operator` | `none`).
- `docs/state-machine.md` §5 — supervisor loop: machine decides, caller executes, including the pause-and-`choose` shape.
