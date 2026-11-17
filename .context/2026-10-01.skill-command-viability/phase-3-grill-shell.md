---
status: completed
phase: 3
order: 3
plan: plan-viability-cleanup.md
phases_overview: plan-viability-cleanup-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Unify b-grill, b-grill-me, and b-grill-with-docs into a single canonical skills/b-grill/ with domain docs enabled by default and --no-docs to opt out."
files:
  - skills/b-grill/
  - plugins/buck-workflow/skills/b-grill/
  - skills/b-grill-me/
  - plugins/buck-workflow/skills/b-grill-me/
  - skills/b-grill-with-docs/
  - plugins/buck-workflow/skills/b-grill-with-docs/
  - prompts/b-grill-me.md
  - prompts/b-grill-with-docs.md
  - skills/b-docs/SKILL.md
  - plugins/buck-workflow/skills/b-docs/SKILL.md
  - GLOBAL_OR_PROJECT-AGENTS.md
  - AGENTS.md
  - scripts/codex-plugin.test.ts
  - README.md
  - docs/buck-workflow.md
from_plan_steps: ["G1"]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] skills/b-grill/SKILL.md is the single canonical grill skill with domain docs (CONTEXT.md + docs/adr/) enabled by default in user mode and --no-docs documented to opt out"
  - "[x] skills/b-grill/grill.py, skills/b-grill/ADR-FORMAT.md, and skills/b-grill/CONTEXT-FORMAT.md exist (and match in plugins/buck-workflow/skills/b-grill/)"
  - "[x] skills/b-grill-me/, skills/b-grill-with-docs/, plugins/buck-workflow/skills/b-grill-me/, and plugins/buck-workflow/skills/b-grill-with-docs/ are gone"
  - "[x] prompts/b-grill-me.md and prompts/b-grill-with-docs.md load ../skills/b-grill/SKILL.md"
  - "[x] A-5: rg -n 'b-grill-with-docs/(ADR|CONTEXT)-FORMAT' skills/ GLOBAL_OR_PROJECT-AGENTS.md AGENTS.md docs/buck-workflow.md returns no hit"
  - "[x] npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts passes"
completed_at: 2026-11-16
completed_by: b-build
---

# Phase 3: Unify the grill family into `b-grill`

## Context

Parent user goal: the maintainer can walk one checklist, change any recommendation, and apply or skip each item without losing the decision. This phase executes parent todo G1.

HARD-depends on Phase 2 because both edit `README.md`, `docs/buck-workflow.md`, and `scripts/codex-plugin.test.ts`.

A-5 is validated: `skills/b-docs/SKILL.md`, `GLOBAL_OR_PROJECT-AGENTS.md`, `AGENTS.md`, and `docs/buck-workflow.md` cite `b-grill-with-docs/ADR-FORMAT.md` and `CONTEXT-FORMAT.md` and must be updated to `b-grill/ADR-FORMAT.md` and `b-grill/CONTEXT-FORMAT.md` in the same step.

If parent-plan G1 Status is `keep` or `skip`, stop and do not delete.

## Implementation Details

1. Move `skills/b-grill-with-docs/ADR-FORMAT.md` and `skills/b-grill-with-docs/CONTEXT-FORMAT.md` into `skills/b-grill/`.
2. Rewrite `skills/b-grill/SKILL.md` to consolidate `b-grill`, `b-grill-me`, and `b-grill-with-docs`:
   - Include the `workflow_state` access header.
   - Make **domain-documentation awareness (`CONTEXT.md` + `docs/adr/` challenge, glossary sharpening, and inline updates) the default behavior** of `b-grill` in user mode.
   - Require an explicit **`--no-docs`** flag to skip `CONTEXT.md` / `docs/adr/` lookups and inline documentation writes.
   - Include Jev `turn_class` classification (`direct_answer`, `addendum`, `arbitrary`), Material Decision Closeout (`skills/_shared/decision-closure.md`), Metadata Tracking, Session File (`## Documentation Decisions`, `## Addenda`, `## Parked`), Document Mode, Feeding the workflow-kernel cell (`PHASES` auto-derive), and `--mode user|auto` (`grill.py`).
3. Sync `skills/b-grill/` (`SKILL.md`, `grill.py`, `ADR-FORMAT.md`, `CONTEXT-FORMAT.md`) to `plugins/buck-workflow/skills/b-grill/`.
4. Update `skills/b-docs/SKILL.md` (and `plugins/buck-workflow/skills/b-docs/SKILL.md`), `GLOBAL_OR_PROJECT-AGENTS.md`, `AGENTS.md`, and `docs/buck-workflow.md` to reference `b-grill/CONTEXT-FORMAT.md` and `b-grill/ADR-FORMAT.md`.
5. Repoint `prompts/b-grill-me.md` and `prompts/b-grill-with-docs.md` to load `../skills/b-grill/SKILL.md` (`b-grill-me.md` runs default docs-aware user mode and passes through `--no-docs` when supplied; `b-grill-with-docs.md` remains a backwards-compatible alias for the default user mode).
6. Delete `skills/b-grill-me/`, `skills/b-grill-with-docs/`, `plugins/buck-workflow/skills/b-grill-me/`, and `plugins/buck-workflow/skills/b-grill-with-docs/`.
7. Remove `b-grill-me` and `b-grill-with-docs` from `scripts/codex-plugin.test.ts` `canonicalCopies`, and update `README.md` and `docs/buck-workflow.md` catalog rows.

## Risks

Deleting `skills/b-grill-with-docs/` without relocating `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` and updating `skills/b-docs/SKILL.md` leaves broken format links. Rollback is `git revert` of this phase commit.

## Verification

```bash
test -d skills/b-grill && test -f skills/b-grill/grill.py && test -f skills/b-grill/ADR-FORMAT.md && test -f skills/b-grill/CONTEXT-FORMAT.md
test ! -d skills/b-grill-me && test ! -d skills/b-grill-with-docs
test ! -d plugins/buck-workflow/skills/b-grill-me && test ! -d plugins/buck-workflow/skills/b-grill-with-docs
rg -n -- "--no-docs" skills/b-grill/SKILL.md
! rg -n "b-grill-with-docs/(ADR|CONTEXT)-FORMAT" skills/ GLOBAL_OR_PROJECT-AGENTS.md AGENTS.md docs/buck-workflow.md
npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts
```

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a new `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`. One phase, one commit.
6. If incomplete, leave `status: in-progress`.
