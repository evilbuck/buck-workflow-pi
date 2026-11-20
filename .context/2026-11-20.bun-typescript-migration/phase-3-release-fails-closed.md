---
status: pending
phase: 3
order: 3
plan: plan-migration-followups.md
phases_overview: plan-migration-followups-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: "Make the release script abort on failed git-status and registry-lookup precursors."
depends_on: []
dependency_type: NONE
files:
  - scripts/publish.ts
  - scripts/publish.test.ts
from_plan_steps: [1, 2, 3]
acceptance_criteria:
  - "[ ] Failed `git status --porcelain` yields non-zero exit and no publish (red/green test)"
  - "[ ] Failed `bun pm view` yields non-zero exit and no publish (red/green test)"
  - "[ ] Empty-vs-failed precursor outcomes distinguished (empty worktree still allowed)"
  - "[ ] New tests mutation-check red (remove the abort → fail)"
completed_at: null
completed_by: null
---

# Phase 3: release script fails closed

## Context
Parent goal (inherited): the release command fails closed on precursor errors. Today `scripts/publish.ts` proceeds to publish when its `git status --porcelain` check or its `bun pm view` registry lookup fails (as opposed to returning a benign empty result).

## Implementation Details
1. Red: rewrite the two "currently proceeds to publish when %s fails" cases in `scripts/publish.test.ts` to expect non-zero exit and no publish for failed `git status --porcelain` and failed `bun pm view`.
2. Green: `publish.ts` gains a `must()` runner that aborts on command failure for those two precursors, distinguishing empty output (benign) from command failure (abort).
3. Mutation-check the new tests.

## Risks
- Over-aborting on benign empty outputs — the empty-vs-failed distinction is the acceptance boundary.

## Verification
`vitest run scripts/publish.test.ts`; `bun run guardrails:check`.

## Per-Phase Execution Loop
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. In-plan `iterate-*.md` → `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. Doc impact flagged → `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.
6. If incomplete, leave `status: in-progress` for resume.
