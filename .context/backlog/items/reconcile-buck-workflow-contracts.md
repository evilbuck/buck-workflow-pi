---
title: Reconcile Buck workflow lifecycle and runtime contracts
status: active
priority: high
created: 2026-07-10
updated: 2026-07-10
completed: null
related:
  - .context/2026-07-10.buck-workflow-implementation-audit/research-workflow-implementation-audit.md
  - .context/backlog/items/plan-implementation-ledger.md
  - .context/backlog/items/b-loop-skill-and-mirror.md
  - .context/2026-07-10.buck-workflow-implementation-audit/plan-buck-workflow-contract-remediation.md
  - .context/2026-07-10.buck-workflow-implementation-audit/plan-buck-workflow-contract-remediation-phases.md
  - skills/b-build/SKILL.md
  - skills/b-review/SKILL.md
  - skills/b-save/SKILL.md
  - skills/git-commit/SKILL.md
  - skills/b-plan/SKILL.md
  - scripts/context-artifacts.mjs
  - docs/buck-workflow.md
---

# Reconcile Buck workflow lifecycle and runtime contracts

## Problem

The whole-system audit found a sound architecture with unsafe executable handoffs and substantial contract drift between skills, prompts, docs, validators, the wired extension, and current OMP runtime behavior.

Load-bearing failures:

1. `b-build` marks a phase completed before review, so no-argument `b-review` can select the next phase.
2. Clean review has no durable evidence; phase/plan completion cannot be reconstructed reliably.
3. `b-save` does not complete plan/subject state or own next-phase backlog promotion as declared.
4. The save → commit flow omits staging; `git-commit` can select a wrong/stale draft.
5. `b-plan` generates workflow eval cells for the obsolete OMP 15.10 API; current OMP 16.3.15 exposes `completion`, not `llm`.
6. Artifact validation excludes phases, iterations, specs, and other workflow artifacts; phase overviews are misclassified as generic plans.
7. `b-build` hardcodes this repository's test stack despite being the portable implementation skill.

## Priority order

### P0 — lifecycle transaction

- Keep a phase `in-progress` through build and review.
- Persist clean-review evidence tied to the exact phase/plan.
- Complete phase, overview, plan, subject index, backlog promotion, memory, staging, and commit as one explicit closeout sequence.
- Resolve draft commits through explicit/current subject context and validate them against the staged diff.

### P0 — OMP executable compatibility

- Update generated eval cells and all eval-kernel docs/stubs for OMP 16.3.15 (`completion`, current `agent` signature, injected helpers).
- Remove `package.json.omp` runtime detection.
- Centralize `none | orchestrate | workflow | goal` recommendation precedence and the goal audit contract.
- Run a generated cell in the real eval kernel as the acceptance test.

### P1 — portable core and schemas

- Make `b-build` discover target-project test/UI/server conventions; remove unconditional approval.
- Define schemas for spec, phase, phase overview, iterate, brainstorm/grill, review-pass, issue, and draft-commit artifacts.
- Generate validator enums and documentation tables from one registry.
- Make `b-save`'s skill canonical and its prompt thin.

### P1 — documentation and surface cleanup

- Repair workflow diagrams and include stage/commit branching correctly.
- Reconcile README's flexible-toolkit language with mandatory durability guarantees.
- Generate command/skill inventories instead of maintaining counts by hand.
- Resolve or retire `b-auto-fix`, `b-grill-auto`, and the unwired `/b-blueprint` claim.
- Finish residual b-flow deprecation: remove active subject-resolution fallback, dead dependency, and mark the historical directory.

## Existing related backlog

- `plan-implementation-ledger.md` covers the review-evidence foundation; expand or supersede it rather than creating a competing ledger.
- `b-loop-skill-and-mirror.md` owns the intentional b-loop slash/docs deferral.
- `multi-harness-symlink-installer.md` appears implemented in `scripts/install.mjs` but remains active; verify its acceptance contract before archiving.

## Acceptance criteria

- A phased smoke scenario cannot advance to Phase N+1 before Phase N has a persisted passing review.
- `b-save` closes plan/subject state and promotes the next phase deterministically.
- The documented closeout includes an explicit staging gate and commits the durable artifacts.
- A generated `workflow` eval cell executes successfully on the maintained OMP version.
- `npm run context:validate` recognizes every current workflow artifact kind without structurally inevitable warnings.
- Core skills contain no target-project-specific test commands unless discovered from the target repository.
- README, `docs/buck-workflow.md`, bootstrap policy, skills, prompts, and loading docs describe the same lifecycle and surface inventory.

## Phased implementation

This item is the non-pickup program index for the 14 discrete phases in `plan-buck-workflow-contract-remediation-phases.md`. Only Phase 1 is active in the backlog queue; later phase items remain under “Upcoming Phases” until their dependencies are completed and committed.

The phase plan makes two consolidation decisions:
- `plan-implementation-ledger.md` is superseded by one target-specific `review-pass-*.md` evidence artifact in Phase 1; no competing ledger is created.
- Incomplete `b-auto-fix` and `b-grill-auto` surfaces retire from active discovery in Phase 11 unless a separately approved runner contract is established.
