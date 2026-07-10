---
status: pending
phase: 12
order: 12
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: medium
model_hint: capable general model; data-driven installer verification and generated inventory
buck_hint: /b-build
goal: "Make package loading and installed surfaces derive from tested executable inventory."
files:
  - package.json
  - scripts/install.mjs
  - scripts/install.test.mjs
  - scripts/surface-inventory.mjs
  - scripts/surface-inventory.test.mjs
  - prompts/**
  - commands/**
  - skills/**
from_plan_steps: [12]
depends_on: [2, 3, 10, 11]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Installer tests prove exact surfaces for every supported harness in isolated homes"
  - "[ ] Generated inventory distinguishes symlinks, regular thin wrappers, skill-only entries, and retired absences"
  - "[ ] Package manifest matches actual Pi and OMP loading behavior"
  - "[ ] Dead runtime dependencies are removed or correctly scoped outside production dependencies"
  - "[ ] Counts and exception lists are generated/tested rather than maintained only in prose"
completed_at: null
completed_by: null
---

# Phase 12: Installer and Surface Inventory

## Context

**Inherited parent goal**: Buck Workflow users install the surfaces the package claims, and maintainers can detect drift automatically.

The installer exists and has tests, but the active backlog still describes it as unfinished; loading docs have stale counts and manifest descriptions. This phase verifies the existing implementation against its original acceptance contract after wrappers and active surfaces settle, then creates one generated inventory for Phase 13.

## Implementation Details

1. Reconcile `scripts/install.mjs` with the existing multi-harness plan and current official harness loading conventions. Preserve no-clobber, idempotency, dry-run, and package-native Pi/OMP behavior.
2. Use temporary fake home directories for Pi, OMP, Claude, Codex, OpenCode, and any explicitly supported Cursor behavior. Assert exact surface sets rather than only that a bootstrap link exists.
3. Add `scripts/surface-inventory.mjs` as a data result, not a prose counter. Record:
   - canonical skills;
   - Pi prompts;
   - OMP commands;
   - symlink mirrors;
   - intentional regular thin wrappers;
   - intentionally skill-only entries such as b-loop;
   - retired/absent surfaces;
   - package manifest registrations.
4. Add focused tests that fail when a new/removed surface is not categorized.
5. Remove dead `xstate` from production dependencies once Phase 11 proves b-flow is not active. If archival tests still require it, either remove those tests/source or scope the dependency explicitly to development; no runtime package claim remains.
6. Reconcile and close the existing `multi-harness-symlink-installer.md` backlog item if its acceptance criteria pass; do not create a second installer track.
7. Emit machine-readable inventory Phase 13 can render. Do not hand-edit final counts into docs yet.

## Risks

- **Harness convention drift**: verify official/current sources during implementation and capture tested limits honestly.
- **Double-loading Pi/OMP**: package-native prompts/commands/skills and bootstrap links must not be installed twice.
- **User-file clobber**: real files require explicit force behavior; default is stop/warn.
- **Inventory becomes another manual list**: derive from filesystem/package metadata and test every exception category.

## Verification

- Run focused `scripts/install.test.mjs` against isolated home fixtures for every supported harness.
- Dry run writes nothing; correct link rerun is no-op; wrong symlink replaces per policy; real file is preserved without force.
- Generated inventory matches the final prompt/command/skill trees and package manifest.
- b-pr regular wrappers are categorized intentionally; b-loop is skill-only; blueprint is mirrored; retired auto/grill surfaces are absent.
- Package install smoke for Pi and OMP shows no double-loading.

## Per-Phase Execution Loop

1. Run `/b-build` against this phase file only.
2. Run installer and inventory focused tests.
3. Run `/b-review` against this exact phase file.
4. Iterate in-plan installer/inventory defects.
5. Run `/b-docs` if documentation impact is flagged; final table regeneration remains Phase 13.
6. Run `/b-save`, stage implementation and durable artifacts, then `/b-commit`.
7. Leave `status: in-progress` until every supported harness has an exact tested surface contract.
