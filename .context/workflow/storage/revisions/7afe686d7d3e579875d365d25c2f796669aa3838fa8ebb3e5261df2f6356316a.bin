# Plan: review severity ranking

## User Goal

The operator running autonomous `/buck-loop` stops paying time and tokens for review findings that do not matter to the end user or the business. After review, each in-plan issue is severity-ranked. Only an issue above the waterline starts `b-iterate`. Below-waterline findings stay on the record, and the loop continues.

## What we might build

- A new buck-loop state immediately after `reviewing`, only when the review found in-plan issues.
- That state calls TypeSafe Jev. It does not spawn a skill child. `WorkState` states spawn skill children, so this state stays outside that set.
- Jev answers five closed questions per issue and does no arithmetic or route selection. The rating is the one stored as SQL memory `01a1025d-c2a2-74cf-baa8-f6f4f9a1e853` and in `30_Resources/AI/Review Issue Severity Rating.md`.
- A deterministic function outside Jev applies the waterline. Any one above-waterline issue routes to `iterating`. None do not.
- When nothing is above the waterline, keep today's non-iterate route: `documenting` if the review flagged docs or howto impact, otherwise `saving`.
- Below-waterline findings are recorded, but not left in an active `iterate-*.md`. That file currently forces `iterating`.
- Ranking, not `b-review`, is what promotes above-waterline issues into the iterate artifact the iterate skill consumes.

## Why it matters

Today `iterateWins()` is true whenever an unfinished `iterate-*.md` exists. One in-plan nit spends a full iterate cycle, up to six per phase. This gate is the spend check between review and that cycle.

## Constraints / preferences

- Jev question types are only `noul`, `choice`, and `score`. No chat-model fallback. A Jev miss or a missing scope, confidence, impact, or likelihood answer fails closed to no iterate.
- Do not default scope to `in_scope` or confidence upward.
- Scope stays a hard gate. Do not blend spec and standards findings into one score. A loud standards nit must not hide a spec miss, and an out-of-scope High must not spend an iterate cycle.
- Rank in-plan issues only. Out-of-plan discoveries and docs/howto impact keep their current routes. The in-scope question still runs per in-plan issue, because review can misclassify.
- The stored waterline: in scope, P(real) >= 0.60, and the impact × likelihood cell is High or Critical. Likelihood 0 or 1 caps the cell at Medium. A regression lowers the bar one cell, to Medium, only when impact is at least moderate. `unknown` regression counts as pre-existing.
- Display ranking in `choice-ranking.ts` stays advisory. This gate is a different call, and it does select a route.

## Open questions

- Where below-waterline findings are recorded so a later reader can see them without `hasIterate()` turning true.
- Whether an unparseable review still opens the old iterate/document/save choice, or blocks, instead of entering ranking.
- The state name. Working name: `ranking`.
- How an issue is identified so each Jev answer can be audited. The review report is prose today. `ReviewFacts` has no per-issue fields.

## Brainstorm notes

- Confirmed 2026-10-03: beneficiary is the operator; the point is also to avoid autonomous spend on work that does not matter to the user or the business.
- Confirmed 2026-10-03: below the waterline, follow the existing non-iterate route. Do not leave an active iterate artifact behind.
- Research: `research-severity-weighting.md`. Sources disagree on whether scope sits inside the score. This plan keeps it outside, because the loop must not spend on unauthorized work.
- Waterline confidence is medium. The formulas are cited. The spend-conservative reading was chosen on purpose.
- Risk: fail-closed no-iterate can skip a real High defect when Jev is down. That is the stored rule, not an accident.
