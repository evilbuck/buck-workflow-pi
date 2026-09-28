---
status: in-progress
phase: 2
order: 2
plan: plan-fix-pr-native-pr-tool.md
phases_overview: plan-fix-pr-native-pr-tool-phases.md
difficulty: medium
model_hint: capable general model preferred
buck_hint: /b-build
goal: "Update the fix-pr skill to the three-layer contract (pr:// orientation, tool-or-CLI exhaustive ingest) and sync the Codex physical copy verbatim."
omp_execution: none
files:
  - skills/fix-pr/SKILL.md
  - plugins/buck-workflow/skills/fix-pr/SKILL.md
from_plan_steps: [4]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] SKILL.md permits optional `pr://` reads for orientation/targeted diff inspection only; a rendered PR view is never a completeness or settlement signal."
  - "[x] Ingest preference order in Phase 1/5c paths: registered tool first, sibling CLI otherwise; both paths produce the same inventory contract; one authoritative inventory per pass, no merging with native projections."
  - "[x] Explicit exit/failure policy and head-OID revalidation retained unchanged."
  - "[ ] `plugins/buck-workflow/skills/fix-pr/` copy is byte-identical (`scripts/codex-plugin.test.ts` passes)."
completed_at: null
completed_by: null
---

# Phase 2: Skill + Codex Copy Sync

## User Goal
Inherited from plan: fix-pr uses native `pr://` where it helps, keeps the deterministic fetcher authoritative via tool (when registered) or CLI (when not), and stays portable across harnesses.

## Context
Depends on Phase 1's tool surface (name `fix_pr_feedback`, availability-by-probe not package metadata). The Codex plugin carries a physical byte-parity copy of the skill enforced by `scripts/codex-plugin.test.ts`.

## Implementation Details
1. Rewrite the tool-preference section and Phase 1/5c paths in `skills/fix-pr/SKILL.md` per the three-layer contract. The skill must select the tool by actual availability, not package metadata.
2. Preserve direct `gh` worktree, commit, push, and issue paths unchanged.
3. Mirror the update into `plugins/buck-workflow/skills/fix-pr/` verbatim.

## Risks
- Parity drift between skill and Codex copy — run the parity test immediately after edits.

## Verification
`bunx vitest run scripts/codex-plugin.test.ts`
