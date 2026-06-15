---
date: 2026-06-14
domains: [skill, planning, buck-workflow]
topics: [b-plan, light-grill, plan-evaluation, ambiguity-resolution, discretion]
related: [".context/2026-06-14.b-plan-light-grill/plan-b-plan-light-grill.md", "skills/b-plan/SKILL.md"]
priority: medium
status: completed
subject: 2026-06-14.b-plan-light-grill
artifacts: ["plan-b-plan-light-grill.md", "index.md"]
---

# b-plan Light Grill (Plan Evaluation) added

Added a discretionary Light Grill pass to `skills/b-plan/SKILL.md`.

## What changed

New `## Light Grill (Plan Evaluation)` section between the existing Clarification Interview Protocol (upstream-ask ambiguity) and Cross-Reference Stitching. Plus a one-line bullet in `## Behavior` pointing at it.

## Design decisions

- **Discretionary, not mandatory.** User's interjection during design: "If the plan is straightforward and doesn't require a grille me session, then let's not invoke extra steps for no reason. Let the model decide." The section opens with "**Use your judgment.** Straightforward, well-bounded plans do not need this."
- **3–10 questions, not 20.** Deliberate contrast with `b-grill-me`. The Light Grill is a one-shot planning step; `b-grill-me` is a multi-session, threshold-tracking artifact.
- **In-plan output, not a separate session file.** Q&A lands as a `## Light Grill` section in the plan body. Rationale: a separate `grill-session-light-*.md` would be ceremony for a 3–10 question pass. The section documents this distinction explicitly so future readers don't try to unify the two.
- **Five trigger categories** (hidden assumptions, scope edges, acceptance criteria gaps, risk/rollback holes, verification gaps) and three skip cases (bounded/unambiguous, upstream `b-grill-me` already ran, technical chore). No frontmatter field added.

## Verification

- Section reads cleanly end-to-end in the file.
- `[Light Grill (Plan Evaluation)](#light-grill-plan-evaluation)` anchor in Behavior matches the heading slug.
- No regression to existing sections (Clarification Interview Protocol, Cross-Reference Stitching, User Goal Requirement) — all unchanged.

## Follow-up worth considering

Whether `b-build` should warn when loading a plan whose `## Light Grill` section shows `deferred:` entries (so the build agent sees which ambiguities are unresolved). Out of scope for this change.
