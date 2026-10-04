# Notes: review severity weighting

Running notes. External standards were consulted on 2026-10-03. The rating below is stored in SQL memory `01a1025d-c2a2-74cf-baa8-f6f4f9a1e853`.

How should buck-loop rank each b-review issue with TypeSafe Jev, then decide whether any issue is above the waterline for `b-iterate`?

Operator factors: severity, likelihood, in-scope, regression.

## Local contract

### Current route is binary

`extensions/buck-loop/machine.ts` `iterateWins()` is true when an unfinished `iterate-*.md` exists. That edge beats docs, howto, and save. A clean parseable report with no iterate artifact goes to `saving`. Docs or howto impact, and no iterate artifact, goes to `documenting`. An unparseable report with none of those flags opens a closed choice among iterate, document, and save.

`ReviewFacts` (`extensions/buck-loop/types.ts`) has no per-issue fields. Scan stores only `parseable`, `iterateArtifact`, `docsImpact`, and `howtoImpact`. Unparseable content is treated as absent flags, not as severity.

### Jev can answer only three closed types

`extensions/typed-output/evaluator.ts` accepts `noul`, `choice`, and `score`. Anything else is an invalid request.

- `noul`: yes/no probability. Criteria object is optional.
- `choice`: criteria object with at least two labels. The label is the answer.
- `score`: ordered criteria array of at least two labels. The answer is a number on that scale.

The judge must not multiply factors or pick the route. A deterministic function outside Jev has to combine the closed answers.

### Existing ranking does not select

`extensions/buck-loop/choice-ranking.ts` asks one `score` question per legal continuation, criteria `Very unlikely` through `Very likely` (0–4, fractions allowed). It sorts for display. Failure returns the unranked legal set and an error. It never selects.

`extensions/buck-loop/choice.ts` is the selector, and only for an already-legal ambiguous set. One `choice` question. Fewer than two legal actions does not call Jev. A Jev miss falls through to the profile chat model, then blocks. That fallback is not acceptable for this gate: a chat model must not imitate the severity judgment or invent a route.

### Review already treats scope as a gate

`skills/b-review/SKILL.md` classifies every issue as in-plan or out-of-plan before any iterate artifact exists.

- In-plan correctness issues write `iterate-*.md` and make the verdict `Needs work`.
- Out-of-plan discoveries do not write that file and do not change the verdict.
- Docs and howto impact are separate non-blocking routes.
- Spec and standards axes must not be merged into one ranked list. A loud standards nit must not outrank a quiet spec violation.

The iterate artifact already has author-written `Critical Issues` and `Warnings` sections. Those headings are not a judged severity.

### State shape constraint

`LoopState` has no ranking state. `WorkState` spawns a nested skill session. A Jev rank call is not a skill session.
## Stored rating

Jev answers five closed questions and does no arithmetic.

- Gate: `choice` `in_scope` | `out_of_scope`. Out of scope never iterates.
- Gate: `noul` P(real in-code defect) `>= 0.60`.
- Score, low to high: impact `negligible, minor, moderate, major, catastrophic`.
- Score, low to high: likelihood `rare, unlikely, possible, likely, almost_certain`.
- Bump only: `choice` `regression` | `pre_existing` | `unknown`. `unknown` counts as `pre_existing`.

Map scores to `0..4`. If likelihood is `0` or `1`, cap the cell at Medium. Iterate iff both gates pass and the cell is High or Critical. A regression lowers that bar one cell, to Medium, only when impact is at least moderate. Any one above-waterline issue iterates. Missing answers or Jev unavailable fail closed to no iterate. No chat-model fallback.

Canonical write-up: `research-severity-weighting.md`.

## Still open

Below-waterline route is confirmed: documenting if docs or howto impact is flagged, otherwise saving. Findings stay on the record, but not in an active `iterate-*.md`. Still open: where that record lives, and what an unparseable review does.

## Confidence

High on the local contract and on the cited formulas. Medium on the adopted waterline: sources disagree, and the spend-conservative reading was chosen.

