---
status: active
date: 2026-10-03
subject: 2026-10-03.review-severity-ranking
topics: [buck-loop, jev, review, severity, waterline]
informs: [plan-review-severity-ranking.md]
---

# Research: review-issue severity rating

## Assessment

Jev should not rank a route and should not multiply factors. It answers five closed questions per issue. A deterministic function outside Jev applies the waterline.

Stored in SQL memory `01a1025d-c2a2-74cf-baa8-f6f4f9a1e853`, subject `2026-10-03.review-severity-ranking`, phase `severity-rating`, category `decision`.

## Rating

| Question | Jev type | Role |
|---|---|---|
| In scope for the accepted plan? | `choice`: `in_scope`, `out_of_scope` | Hard gate. Out of scope never iterates. |
| Is this a real in-code defect? | `noul` probability | Hard gate. Need `>= 0.60`. |
| Impact if real | `score`: negligible, minor, moderate, major, catastrophic | Weight. Low to high. |
| Likelihood it triggers | `score`: rare, unlikely, possible, likely, almost_certain | Weight. Low to high. Caps impact. |
| Regression? | `choice`: `regression`, `pre_existing`, `unknown` | One-cell bump only. `unknown` = `pre_existing`. |

Combine outside Jev:

1. Map each score to `0..4`.
2. If likelihood is `0` or `1` (rare or unlikely), cap the cell at Medium. A severe issue that rarely happens does not spend an iterate cycle on impact alone.
3. Iterate iff in scope, `P(real) >= 0.60`, and the cell is High or Critical.
4. A regression lowers that bar one cell, to Medium, only when impact is at least moderate. Both gates still apply.
5. Any one above-waterline issue routes to `b-iterate`. None do not.
6. Missing scope, confidence, impact, or likelihood, or Jev unavailable, fails closed to no iterate. No chat-model fallback. Do not default scope in or confidence up.

## Why this shape

- OWASP: `Risk = Likelihood × Impact`. Not all risk is worth fixing.
- Mozilla RRA: low likelihood caps high impact at medium risk. Used here because this decision spends tokens.
- ISO 31000: scope is the frame for the assessment, not a term inside the score.
- CVSS qualitative High starts at 7.0. That is the spend waterline, not a copied CVSS equation. CVSS scores scope inside the base equation; this rating does not, because an out-of-scope High is still unauthorized spend.
- MSRC: Important and Critical are fixed first. Moderate is case-by-case. Regression is servicing policy, not a severity multiplier.

## Local constraint

Today `iterateWins()` is true whenever an unfinished `iterate-*.md` exists, and that edge beats docs, howto, and save. `ReviewFacts` has no per-issue fields. A ranking step cannot be a `WorkState`: those spawn a skill child. Jev route selection in `choice.ts` falls through to a chat model; this gate must not.

## Open

Confirmed: when nothing is above the waterline, follow the existing non-iterate route. Documenting if docs or howto impact is flagged, otherwise saving. Below-waterline findings must not remain in an active `iterate-*.md`.

Still open: where those findings are recorded, and whether an unparseable review enters ranking.


## Sources

See `research/sources-severity-weighting.md`. Access date 2026-10-03.
