---
status: pending
phase: 9
order: 9
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; schema migration, classifier ordering, and relational integrity
buck_hint: /b-build-hard
goal: "Make one registry describe and validate every durable Buck Workflow artifact kind."
files:
  - scripts/context-artifact-schemas.mjs
  - scripts/context-artifacts.mjs
  - scripts/context-artifacts.test.mjs
  - docs/context-artifacts.md
from_plan_steps: [9]
depends_on: [1, 2, 3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Every current workflow artifact kind is classified and validated by one registry"
  - "[ ] plan-*-phases.md uses a phases-overview schema instead of generic plan schema"
  - "[ ] Status enums are scoped by artifact kind"
  - "[ ] Validation severity is typed rather than inferred from message text"
  - "[ ] Phase counts, overview rows, links, and review-pass targets receive relational checks"
completed_at: null
completed_by: null
---

# Phase 9: Artifact Registry and Integrity

## Context

**Inherited parent goal**: Buck Workflow users and maintainers can trust durable context as validated state rather than an untyped collection of filenames.

The validator recognizes only five kinds, misclassifies phase overviews, and couples severity to message strings. Phases 1–3 settle the new review-pass, closeout, memory, and draft contracts. This phase expands the registry substrate once, without inventing another schema source.

## Implementation Details

1. Make `scripts/context-artifact-schemas.mjs` the single registry for filename classification, required fields, per-kind enum/status rules, titles, index inclusion, and relationship metadata.
2. Cover current kinds: memory, subject index, research, generic plan, phases overview, discrete phase, spec, iterate, review-pass, brainstorm, grill/grill-auto session if historical, issue handoff, draft commit, and backlog item.
3. Order classifiers from specific to generic so `plan-*-phases.md` cannot match `plan-*` first.
4. Replace string-coupled severity with typed validation results (`error|warning` plus code/path/message).
5. Extend generated indexes to expose real kinds rather than flattening unknown artifacts.
6. Add relationship checks where deterministic:
   - referenced files exist;
   - phase count matches discrete files and overview rows;
   - phase/overview status mirrors agree;
   - `source_plan`, `plan`, `phases_overview`, `reviews`, and memory links resolve;
   - review-pass targets the same subject/scope;
   - draft subject/scope fields are coherent.
7. Keep legacy artifacts visible. Warn for real missing legacy metadata; never warn merely because the validator lacks their kind.
8. Generate the machine-readable data Phase 13 will render into documentation; do not hand-maintain duplicate status tables here.

## Risks

- **Registry overreach**: validate deterministic structure, not prose semantics or source text.
- **Legacy warning flood**: classify legacy forms explicitly and distinguish deprecation warnings from invalid current artifacts.
- **Circular generation**: registry is input; docs/index outputs never become schema authority.
- **Lifecycle coupling**: no new status aliases; consume Phase 1–3 contracts exactly.

## Verification

- Add positive and negative fixtures for every artifact kind.
- Direct classifier smoke returns `phases-overview`, `phase`, `iterate`, `spec`, `review-pass`, and `draft-commit` correctly.
- Valid new phased subject has no structurally inevitable warnings.
- Mismatched phase count/table/link fixture emits stable typed errors with codes.
- Existing legacy corpus remains indexed and warns only for real contract gaps.
- Run focused `scripts/context-artifacts.test.mjs` and `npm run context:validate`.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only.
2. Run focused artifact tests and validator corpus smoke.
3. Run `/b-review` against this exact phase file.
4. Iterate in-plan schema/classifier defects and rerun focused tests.
5. Run `/b-docs` if documentation impact is flagged.
6. Run `/b-save`, stage implementation and durable artifacts, then `/b-commit`.
7. Leave `status: in-progress` if any current artifact remains unclassified or an overview warning is structurally inevitable.
