---
status: pending
phase: 13
order: 13
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: medium
model_hint: capable general model; generated reference synchronization across bootstrap and harness guidance
buck_hint: /b-build
goal: "Regenerate reference contracts from artifact and surface registries."
files:
  - docs/context-artifacts.md
  - docs/extension-loading.md
  - GLOBAL_OR_PROJECT-AGENTS.md
  - skills/cross-platform-pi-omp-loading/SKILL.md
  - docs/b-flow.md
  - skills/b-loop/SKILL.md
  - scripts/context-artifact-schemas.mjs
  - scripts/surface-inventory.mjs
from_plan_steps: [13]
depends_on: [5, 6, 8, 9, 12]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Artifact/status reference tables are generated from the schema registry"
  - "[ ] Loading counts, manifest fields, and wrapper exceptions are generated from surface inventory"
  - "[ ] Bootstrap status vocabularies are scoped per artifact kind"
  - "[ ] Cross-platform guidance describes the current thin-runtime architecture"
  - "[ ] b-loop is documented as intentionally skill-only without lifting its separate deferral"
completed_at: null
completed_by: null
---

# Phase 13: Reference Contract Regeneration

## Context

**Inherited parent goal**: Buck Workflow maintainers and package authors can consult one current reference instead of reconciling stale hand-written counts and contradictory status tables.

Phases 9 and 12 produce schema and surface truth. Runtime/session ownership is stable after Phases 5, 6, and 8. This phase regenerates contract references before the broader workflow narrative is rewritten.

## Implementation Details

1. Render artifact kinds, required fields, per-kind statuses, and relationship rules from `context-artifact-schemas.mjs` into `docs/context-artifacts.md` or a checked generated block.
2. Replace the bootstrap's “three universal statuses” with scoped status vocabularies that match the registry: subject/research/plan, phase, memory, backlog, review-pass, and other kinds as defined.
3. Render skill/prompt/command counts and exception categories from `surface-inventory.mjs` into `docs/extension-loading.md`; explain package manifest fields exactly as installed.
4. Update cross-platform authoring guidance so it no longer teaches removed extension-owned `b-save`, `b-mode`, `b-restrict`, session injection, or b-flow behavior.
5. Keep `docs/b-flow.md` unmistakably historical and align it with the final archival/removal choice.
6. Document `b-loop` as intentionally skill-only and link its existing backlog owner; do not add the mirror here.
7. Add generation/parity checks so hand edits that drift from registries fail focused verification.

## Risks

- **Generated blocks overwrite narrative**: delimit generated tables and keep human rationale outside them.
- **Bootstrap overgeneralization**: status tables name artifact kinds; do not invent another universal set.
- **Inventory semantics**: distinguish “not installed,” “skill-only,” “regular thin wrapper,” and “retired.”
- **Historical docs become active guidance**: archival banners must be explicit at entry.

## Verification

- Regenerate twice; second run is byte-for-byte no-op.
- Change a fixture registry entry; parity test detects stale generated output.
- Compare loading reference to package manifest and actual tree inventory.
- Bootstrap examples validate against Phase 9 per-kind schemas.
- Cross-platform skill contains no claims that the wired extension registers b-save/session modes.
- b-loop docs state skill-only and point at the separate deferral.

## Per-Phase Execution Loop

1. Run `/b-build` against this phase file only.
2. Run registry/inventory generation and idempotency checks.
3. Run `/b-review` against this exact phase file.
4. Iterate in-plan reference drift.
5. Run `/b-docs` if additional living-documentation impact is flagged.
6. Run `/b-save`, stage generated/reference and durable artifacts, then `/b-commit`.
7. Leave `status: in-progress` if any reference table remains hand-maintained or inconsistent.
