---
status: pending
phase: 3
order: 3
plan: plan-viability-cleanup.md
phases_overview: plan-viability-cleanup-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Delete the b-grill shell and leave the three grill commands as the catalog."
files:
  - skills/b-grill/
  - plugins/buck-workflow/skills/b-grill/
  - scripts/codex-plugin.test.ts
  - README.md
  - docs/buck-workflow.md
from_plan_steps: ["G1"]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] cmp skills/b-grill/grill.py skills/b-grill-auto/grill.py was run before deletion and the files were identical, or the phase stopped without deleting"
  - "[ ] skills/b-grill/ and plugins/buck-workflow/skills/b-grill/ are gone"
  - "[ ] skills/b-grill-me/, skills/b-grill-auto/, and skills/b-grill-with-docs/ remain, including ADR-FORMAT.md and CONTEXT-FORMAT.md"
  - "[ ] README.md and docs/buck-workflow.md grill rows name the three remaining skills, not skills/b-grill/SKILL.md"
  - "[ ] npx vitest run scripts/codex-plugin.test.ts passes"
completed_at: null
completed_by: null
---

# Phase 3: Delete the grill shell

## Context

Parent user goal: the maintainer can walk one checklist, change any recommendation, and apply or skip each item without losing the decision. This phase is parent todo G1.

HARD-depends on Phase 2 because both edit `README.md`, `docs/buck-workflow.md`, and `scripts/codex-plugin.test.ts`.

Jev distinctness for `b-grill` was 0.85. `b-grill-with-docs` owns the extra contract (distinct 1.99, conf 0.99). Keep `b-grill-me`, `b-grill-auto`, and `b-grill-with-docs`.

If parent-plan G1 Status is `keep` or `skip`, stop and do not delete.

## Implementation Details

1. Run `cmp skills/b-grill/grill.py skills/b-grill-auto/grill.py`. If they differ, stop. Set this phase back to `pending` and note the diff on the parent G1 todo. Do not merge the scripts in this phase.
2. If they match, delete `skills/b-grill/` and `plugins/buck-workflow/skills/b-grill/`.
3. Remove `b-grill` from `scripts/codex-plugin.test.ts` `canonicalCopies`. Do not add `b-grill-auto` to the bundle unless the operator asks. Codex already lacks `b-grill-auto`.
4. Repoint README and `docs/buck-workflow.md` grill rows to `b-grill-me`, `b-grill-auto`, and `b-grill-with-docs`. Leave `skills/b-grill-with-docs/ADR-FORMAT.md` and `CONTEXT-FORMAT.md` in place. `b-docs` cites those paths.

## Risks

A differing `grill.py` means the shell has unique behavior. Stopping is the mitigation. Rollback of a completed delete is `git revert` of this phase commit.

## Verification

```bash
test ! -d skills/b-grill
test ! -d plugins/buck-workflow/skills/b-grill
test -f skills/b-grill-with-docs/ADR-FORMAT.md
test -f skills/b-grill-with-docs/CONTEXT-FORMAT.md
test -d skills/b-grill-me && test -d skills/b-grill-auto
npx vitest run scripts/codex-plugin.test.ts
```

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a new `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`. One phase, one commit.
6. If incomplete, leave `status: in-progress`.
