---
status: pending
phase: 4
order: 4
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Expose one native workflow_state tool + shared CLI with stage-appropriate permissions, artifact-token references, and cut over the OMP plan bridge, subject picker, and all canonical skill artifact writers/readers."
files:
  - skills/_shared/scripts/workflow-state.ts
  - extensions/workflow-state/
  - extensions/index.ts
  - plugins/buck-workflow/skills/
from_plan_steps: [4]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] workflow_state native tool + shared CLI expose typed logical operations; artifact tokens/references replace mandatory physical paths in skill inputs."
  - "[ ] OMP tools and restricted children get stage-appropriate read/write permissions with the same trusted context binding; normal callers cannot supply arbitrary project or visibility scope."
  - "[ ] Portable skills fall back to the CLI when native tools are unavailable; no chat-model SQL construction; no hidden local-file canonical mirror; no unscoped raw SQL knowledge read."
  - "[ ] Old model-facing sql_memory recall/remember/correct raw-SQL path and environment-switch registration removed after caller cutover; migration/administration stays CLI-only."
  - "[ ] OMP plan bridge, subject picker, and canonical artifact-writing/reading skills (brainstorm/research/explore/plan/phase/build/review/iterate/save/recap/present/capture/commit) use the new surface; every discovered hardcoded durable path updated, not only named examples."
  - "[ ] Release bundle (plugins/buck-workflow/skills/) and installer shipping rules synchronized; ranking metadata and receipt/readback semantics preserved."
completed_at: null
completed_by: null
---

# Phase 4: Native Tool, CLI & Skill Cutover

## User Goal
Technical chore — access-surface layer; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: choose durable storage, resume reliably, branch-private unmerged work. Needs Phase 3 domain operations to exist. This phase is where normal model-facing access stops depending on physical `.context` paths and raw SQL. Plan step 4.

## Implementation Details
1. `skills/_shared/scripts/workflow-state.ts` + `extensions/workflow-state/` binding: typed operations over the store; bind project/visibility context in trusted runtime/CLI only.
2. CLI: matching shared CLI for portable skills; explicit inspect/recover operations name cross-branch scope and retain evidence.
3. Cut over OMP plan bridge, subject picker, and all canonical skills to artifact references; update every discovered hardcoded durable path (plan Affected-files list is the seed, not the limit).
4. Remove obsolete normal model-facing raw-SQL paths only after their callers migrate; keep administration explicit in the CLI.
5. Sync installer, `extensions/index.ts`, command wrappers, and the canonical bundle.

## Risks
- Skill cutover breadth is large — use the Phase 1 inventory as the checklist; a missed consumer is an in-scope defect, not follow-up.
- Bundle/mirror drift between `skills/` and `plugins/buck-workflow/skills/` — verify byte parity.

## Verification
- Native and CLI workflows run without canonical `.context` materialization under external-files/SQLite/PostgreSQL selection.
- Restricted child sessions cannot widen project/visibility scope (negative test).
- `npm run guardrails:check`; bundle parity check; changed command wrappers exercised.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
