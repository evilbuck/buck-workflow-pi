---
status: pending
phase: 8
order: 8
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: easy
model_hint: capable general model; mostly verification and documentation
buck_hint: /b-build
goal: "Exercise complete workflows on all four adapters, run guardrails and install/bundle checks, and document configuration, publication, migration, recovery, and dotfile exclusions."
files:
  - docs/
  - CHANGELOG.md
  - GLOBAL_OR_PROJECT-AGENTS.md
from_plan_steps: [8]
depends_on: [7]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Real OMP workflow per backend (brainstorm/research/plan → phase → build/review/iterate → save/checkpoint → restart/resume) reads back exact artifact IDs/revisions and completed attempt receipts."
  - "[ ] All plan acceptance criteria re-checked against live behavior; parent plan checkboxes updated with evidence."
  - "[ ] Existing deterministic suite + `npm run guardrails:check` pass; install, bundle parity, and changed plan-site surface smoke pass."
  - "[ ] Docs updated: storage configuration, publication rules, migration/recovery, backup, dotfile exclusions (config-only dotfiles; SQLite/WAL/SHM, manifests, exports, receipts excluded), `docs/sql-memory.md`, `docs/buck-loop.md`, `docs/buck-workflow.md`, how-tos, `CHANGELOG.md`, AGENTS managed conventions."
  - "[ ] No dual-write pipeline, obsolete raw-SQL recall path, or second active memory store remains anywhere in the shipped surface."
completed_at: null
completed_by: null
---

# Phase 8: End-to-End Proof, Docs & Packaging

## User Goal
Technical chore — integration proof; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: choose durable storage, resume reliably, branch-private unmerged work. Final integration over all prior phases; each earlier phase carried its own behavioral checks — this phase is whole-system proof and documentation, not delayed testing. Plan step 8.

## Implementation Details
1. Per-backend live OMP workflow exercises including edge state kinds (presentation attachment, retained pass audit, hook memory, attribution/import cursor).
2. Re-walk the parent plan's acceptance criteria list against observed behavior; record evidence per item.
3. Run existing suites, guardrails, fresh install/bundle tests, plan-site smoke where changed.
4. Documentation pass via `/b-docs` + `/b-howto`: configuration schema, publication/promotion rules, explicit mapping for rewritten history, migration/cutover, backup/recovery, dotfile exclusion list.
5. Changelog entry; AGENTS managed-conventions refresh if conventions changed.

## Risks
- Only risk is discovering integration gaps late; if found, they are in-plan iterate findings for this phase's scope or explicit new `/b-plan` cycles — do not silently shrink scope.

## Verification
- The per-backend live workflow transcripts and read-back evidence are the deliverable; attach/references in `/b-save` memory.
- `npm run guardrails:check` green; install/bundle parity green.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
