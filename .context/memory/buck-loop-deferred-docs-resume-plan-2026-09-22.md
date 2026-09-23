---
date: 2026-09-22
domains: [planning, extensions, testing]
topics: [buck-loop, documentation-routing, dirty-tree, resume-safety]
related:
  - .context/2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume/plan-fix-buck-loop-deferred-docs-and-in-cycle-resume.md
  - .context/backlog/items/fix-buck-loop-deferred-docs-and-in-cycle-resume.md
  - .context/2026-09-21.jev-decision-opportunities/phase-2-review-contract-and-routing.md
  - .context/2026-09-21.jev-decision-opportunities/phase-3-fix-or-continue-recovery.md
priority: high
status: completed
subject: 2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume
artifacts:
  - plan-fix-buck-loop-deferred-docs-and-in-cycle-resume.md
---

# Buck-loop deferred-docs and resume plan

## Outcome

Created a bounded, non-phased plan for the Teleport regression: deferred living-doc/how-to language must route directly to save, stale documenting work must advance when corrected impact flags are false, and blocked in-cycle source work must resume without an out-of-band commit.

## Decisions

- Keep prose parsing fail closed until typed `buck.review/v1` routing lands in the existing Jev Phase 2 plan.
- Recognize only explicit no-current-impact or named-later-phase deferral language; affirmative and vague wording remains flagged.
- Use the Git index as the blocked-cycle ownership boundary: a loop that started clean stages its work before returning an in-cycle block; blocked resume permits staged-only work but rejects later unstaged, untracked, or mixed-status dirt.
- Preserve protected-branch, dirty-start, unreadable-projection, and dirty non-blocked-resume refusals.
- Keep the exact Teleport wording as a public regression so the future typed cutover can replace parser internals without losing behavior coverage.

## Validation

- Focused validation returned no frontmatter errors for the new plan or updated backlog item.
- Subject lifecycle inspection reported canonical `active`, revision 2, with the unphased active plan as the expected closeout blocker.
- The backlog item links the saved plan.
- Whole-repository context validation remains non-green because of pre-existing legacy artifact warnings and the pre-existing invalid `status: in-progress` in `.context/memory/mattpocock-adoption-2026-09-10.md`; this plan introduced no focused validation errors.
- Docs-only planning checkpoint; deterministic code guardrails do not apply.
