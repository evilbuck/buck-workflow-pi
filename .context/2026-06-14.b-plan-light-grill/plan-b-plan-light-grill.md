---
status: completed
date: 2026-06-14
subject: 2026-06-14.b-plan-light-grill
topics: [b-plan, light-grill, plan-evaluation, ambiguity-resolution, discretion]
research: []
iterations: []
spec: null
memory: [b-plan-light-grill-2026-06-14.md]
---

# Plan: b-plan Light Grill (Plan Evaluation)

## User Goal
As a Buck workflow user running `/b-plan`, I want plans with material ambiguities to get a short, plan-targeted Q&A pass before they're finalized — so the plan that lands in `.context/` has its fuzzy edges resolved. Straightforward plans should not be slowed down by ceremony.

## Goal
Add a discretionary Light Grill protocol to `skills/b-plan/SKILL.md`. The model decides per-plan whether to invoke: 3–10 questions when the draft has material ambiguities, skip without ceremony otherwise.

## Context used / assumptions
- The existing `## Clarification Interview Protocol` covers ambiguity in the *user's ask* (upstream, opportunistic). It does not cover ambiguity in the *plan itself* once drafted.
- `b-grill-me` is the heavyweight sibling: interviews relentlessly to a 20-question threshold, writes a separate `grill-session-*.md`, tracks decision domains for phasing. Too heavy for the in-plan use case.
- User interjection during design: "If the plan is straightforward and doesn't require a grille me session, then let's not invoke extra steps for no reason. Let the model decide." → protocol must be discretionary, not mandatory.
- Assumption: the Q&A belongs inside the plan body, not in a separate session file. The plan-targeted grill is a one-shot planning step, not a multi-session artifact.

## Scope
In scope:
- New `## Light Grill (Plan Evaluation)` section in `skills/b-plan/SKILL.md` describing when to invoke, how to run, when to skip, and the output format.
- One-line bullet in `## Behavior` pointing at the new section.

Out of scope:
- New frontmatter field for plan files. The Q&A lives in the plan body; no `grill:` field.
- Changes to `b-grill-me`, `b-grill-with-docs`, or `docs/buck-workflow.md`. The new section references them but does not modify them.
- Updates to existing plan files in `.context/` — they predate the protocol and remain valid.
- A separate `b-plan-grill` skill. The b-flow deprecation lesson (2026-06-01) is "no new skill when an existing one can absorb the work."

## Affected files
| File | Change |
|---|---|
| `skills/b-plan/SKILL.md` | Add `## Light Grill (Plan Evaluation)` section + Behavior bullet. |

## Implementation steps
1. Read current `skills/b-plan/SKILL.md` end-to-end to confirm section boundaries (Clarification Interview Protocol ends before Cross-Reference Stitching).
2. Read `skills/b-grill-me/SKILL.md` to confirm the heavyweight pattern the Light Grill is deliberately *not* copying (separate session file, 20-question threshold, decision-domain tracking).
3. Insert the new section between Clarification Interview Protocol (line 71) and Cross-Reference Stitching.
4. Add a one-line bullet in `## Behavior` referencing the new section, after the "Interview the user when clarification is needed" bullet.
5. Verify the file still reads cleanly (the section ordering matters: upstream ask → plan → stitching).

## Verification
- `skills/b-plan/SKILL.md` has `## Light Grill (Plan Evaluation)` header immediately after the Clarification Interview Protocol.
- Behavior section has a bullet linking to `#light-grill-plan-evaluation`.
- No frontmatter changes; no separate session file format introduced.
- The section explicitly contrasts itself with `b-grill-me` (3–10 questions vs 20, in-plan vs separate file, one-shot vs multi-session).
- Read end-to-end: the new section sits naturally between the upstream-ask protocol and the stitching protocol.

## Risks
- **R1 — Protocol drift into mandatory.** The Light Grill is discretionary. Risk: future edits make it feel required. *Mitigation*: the section opens with "**Use your judgment.** Straightforward, well-bounded plans do not need this." and the "When to skip" subsection is explicit.
- **R2 — Confusion with `b-grill-me`.** Two grilling concepts in one workflow. *Mitigation*: the section explicitly names the contrast (3–10 vs 20, in-plan vs session file, one-shot vs threshold-tracking).
- **R3 — Cross-section anchoring.** The `[Light Grill (Plan Evaluation)](#light-grill-plan-evaluation)` link in Behavior must match the heading slug. *Mitigation*: GitHub-style anchor; verified by reading the rendered section.

## Recommended next step
Done. For follow-ups, consider whether `b-build` should similarly warn when it loads a plan with `## Light Grill` showing deferred questions (so the build agent knows which ambiguities are unresolved).
