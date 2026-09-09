---
status: completed
date: 2026-09-09
subject: 2026-09-09.review-response-style
topics: [code-review, agent-instructions, response-style]
review_verdict: request-changes
---

# Review: `GLOBAL_OR_PROJECT-AGENTS.md` response-style changes

## Verdict

**Request Changes** — the principles are good, but adding a 228-line third response-style policy makes the bootstrap less concise and creates competing output rules.

> **[comment on proposal]** Agree — do not ship the 228-line add. Competing always-on rules are the defect, not just length. Recency will make the new section win, including the parts that fight § Communication Style.

## Summary

The change correctly emphasizes answer-first writing, progressive disclosure, direct causal explanations, material caveats, and stopping when the answer is complete. Its implementation repeats two existing response-style sections and is much longer than the behavior it is trying to enforce.

> **[comment on proposal]** Accurate. Diff is `+228` / `−0` on `GLOBAL_OR_PROJECT-AGENTS.md` only. Sections at lines 7 and 278 already duplicated this contract on HEAD; the new block at 310 makes it three.

## Strengths

- Clear answer-first hierarchy.
- Good distinction between necessary context and optional background.
- Strong guidance to report outcomes rather than narrating tool use.
- Explicit protection against omitting risks, uncertainty, and breaking changes.

> **[comment on proposal]** The “do not omit risks / uncertainty / breaking changes” bit (lines 469–489) is the one unique load-bearing idea. Keep that sentence in the short canonical policy; do not throw it out with the examples.

## Findings

### [blocking] A third, 228-line style policy dilutes the instruction — `GLOBAL_OR_PROJECT-AGENTS.md:310`

The file already defines the same contract under `Communication Style (Default — Always On)` at line 7 and `Default Response Style` at line 278. The new section repeats conclusion-first, progressive disclosure, no narration, material-risk exceptions, and stop-when-complete guidance.

For a global bootstrap, repetition adds prompt weight without adding a new decision. It also models the opposite of the requested behavior: a concise policy becomes 228 additional lines.

**Suggested fix:** replace all three sections with one canonical section of roughly 15–30 lines. Keep the answer-first rule, minimum necessary context, conditional caveats/next steps, one length guideline, the stop rule, and at most one compact example.

> **[comment on proposal]** Consolidation is the right fix, not a third pass of edits. Put the surviving section at the top (line 7 slot), not after Specialized Roles. 15–30 lines is tight if one example and the cryptic/risks rule stay — ~20–40 is fine; still far under 228. Reverting the add is not enough: merge the two pre-existing sections even if this block is discarded.

### [important] The default technical template conflicts with the heading rule — `GLOBAL_OR_PROJECT-AGENTS.md:370`

The new section says technical responses should default to `What changed`, `Why`, and `Important` headings. Line 16 says headings should be used only when a response is genuinely long. Agents can satisfy either instruction, but not both consistently on routine tasks.

**Suggested fix:** make the template optional: use those fields only when structure improves comprehension; otherwise answer in one sentence or a compact list.

> **[comment on proposal]** Real conflict: line 16 (“headings only when genuinely long”) vs line 370 (“default to What changed / Why / Important”). Do not keep those headings as a default template. Fields, not headings, and only when they help.

### [important] The length and content targets can cause padding — `GLOBAL_OR_PROJECT-AGENTS.md:314`

The four-item goal can be read as requiring outcome, rationale, caveat, and next action in every answer. `Prefer 2–5 short paragraphs` similarly suggests two paragraphs is the floor. Both work against the stated minimum-context goal for simple questions.

**Suggested fix:** say “Include only what applies: outcome; direct reason if non-obvious; material caveat; required next action. Most routine answers should be 1–5 sentences or a compact list. Never pad to meet a format.”

> **[comment on proposal]** Agree with this wording. The four-item goal + “Prefer 2–5 short paragraphs” reads as a floor and will pad simple answers. Symptom of the blocking finding — fixed by the same consolidation, not a separate rewrite.

### [nit] The phrase blacklist and three example pairs are over-specified — `GLOBAL_OR_PROJECT-AGENTS.md:345`

The existing `No filler` rule already covers the blacklist, and one representative before/after example is enough to demonstrate the tone. The remaining examples mostly repeat the prose rules.

**Suggested fix:** keep one terse example and remove the rest.

> **[comment on proposal]** Agree, nit. Phrase blacklists cause synonym dodge. One example. Also drop first-person “give me” / “I ask” — the rest of the bootstrap is agent-directive.

## Recommended Core

1. Lead with the answer, decision, or outcome.
2. Add only the context needed to understand or act on it.
3. Explain why only when it is not obvious.
4. Include risks, uncertainty, breaking changes, or next actions only when material and applicable.
5. Prefer 1–5 sentences or a compact list for routine responses; never pad to fit a template.
6. Do not narrate reasoning, tool use, or chronology unless it affects the result.
7. Use headings and tables only when they improve a genuinely longer answer.
8. Expand for explicit requests, architecture, subtle bugs, or consequential trade-offs; keep the conclusion first.
9. Remove repetition and stop when the answer is complete.

> **[comment on proposal]** This 9-point list is the right content for the replacement section. Do not cut item 4 to hit a line budget. No heading template, no paragraph floor.

## Posted

- Local only.

## Next Step

Consolidate the three response-style sections into one short canonical policy before committing.

> **[comment on proposal]** Same next step. Findings 2 and 3 are symptoms of finding 1 — one pass, not three independent rewrites.

## Second-Pass Validation — 2026-09-09

All four findings and every inline comment verified against the file. Nothing overturned.

| Claim | Verdict |
|---|---|
| `+228 / −0`, append-only, this file only | confirmed (`git diff --stat`; HEAD 308 → 536) |
| Three overlapping policies at 7 / 278 / 310 | confirmed |
| Template vs heading-rule conflict at `:370` | confirmed, but understated — see below |
| Padding risk from `:314-319` + `:338` | confirmed |
| Blacklist and three example pairs redundant with `:17` | confirmed |
| `:469-489` is the only unique load-bearing idea | confirmed — a plain revert loses it |

Scale: response-style policy is now **267 of 536 lines (~50%)** of the bootstrap; the new section alone is 6.7 KB (~1.7k tokens) per session, per harness.

**Sharper than finding 2.** The file prescribes *four* response shapes — `:20-23`, `:289-292`, `:325-330`, `:374-384` — with no precedence rule. Technically `:374` uses bold labels, not headings, so the literal clash with `:16` is weaker than stated; the ambiguity is worse.

**Missed by the review — the change is already live.** `~/.omp/agent/AGENTS.md` is a symlink to this repo, so the uncommitted +228 is in effect for OMP sessions now. `~/.claude/CLAUDE.md` points at a separate clone stuck at `c6859ec`, and `~/.pi/agent/AGENTS.md` is a plain copy 318 diff lines behind. Consolidation is not done until both are refreshed.

**Note.** OMP already ships its own `§ Tone` contract in the system prompt, so this section is a fourth layer there. Its value is for Claude Code / Codex / Pi, which have none — an argument for keeping it short, not for dropping it.

**Minor disagreement.** The 9-point Recommended Core overlaps internally (1-2-3, 5-6); folded to 10 bullets with full coverage in the plan.

Plan: [`plan-response-style-consolidation.md`](plan-response-style-consolidation.md)

**Resolved 2026-09-09.** Consolidated into a single 10-bullet `## Response Style (Default — Always On)` at line 7; the bootstrap is 285 lines. Stale Pi and Claude Code bootstraps re-synced. Record: [`../memory/response-style-consolidation-2026-09-09.md`](../memory/response-style-consolidation-2026-09-09.md).
