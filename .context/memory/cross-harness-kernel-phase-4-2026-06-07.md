---
date: 2026-06-07
domains: [implementation, buck-workflow, omp, eval-kernel, planning, skill-authoring]
topics: [b-grill-me, b-grill-with-docs, decision_domains, PHASES, auto-derive, mapping, eval-cell, workflow-kernel, skill-section]
related: []
priority: medium
status: completed
subject: 2026-06-06.omp-integration-buck-workflow
artifacts:
  - plan-cross-harness-kernel.md
  - phase-4-b-grill-integration.md
  - skills/b-grill-me/SKILL.md
  - skills/b-grill-with-docs/SKILL.md
  - docs/eval-kernel.md
---

# Cross-harness kernel — Phase 4 build (final)

Phase 4 closes the loop between `b-grill-me` / `b-grill-with-docs` and
the eval cell. F9 from follow-ups. Hard-deps on Phases 2 and 3: the
`decision_domains → PHASES` mapping is defined in
`docs/eval-kernel.md` (Phase 2); the cell shape is exercised in the
two example cells (Phase 3).

## Edits (four)

1. `skills/b-grill-me/SKILL.md` — appended a new
   "## Feeding the workflow-kernel cell" section (after the
   "Non-interactive Mode" section). Contains the mapping table, the
   5-step auto-derive algorithm, a "Why this is opt-in" note, and a
   "Schema stability note". The new section is *a new skill section,
   not a new skill* (b-flow deprecation lesson).

2. `skills/b-grill-with-docs/SKILL.md` — appended the same section,
   plus a "Siblings" callout pointing at `b-grill-me` and a
   "Doc-mode interaction" subsection covering the cases where
   `b-grill-with-docs` produces CONTEXT.md / ADR updates that aren't
   captured in `decision_domains` and the user fills the cell by
   hand.

3. `docs/eval-kernel.md` — appended a "### decision_domains → PHASES"
   subsection to the "Schemas" section. States the three invariants:
   one `agent()` per domain, schema unchanged, judge prompt names
   the domains explicitly. Notes the fallback to user-fills-by-hand
   when `decision_domains` is empty.

4. `.context/2026-06-06.omp-integration-buck-workflow/index.md` —
   `status: completed`. Subject folder is finished.

5. `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md`
   — phase summary table now reads `completed (2026-06-07)` for all
   four rows.

## Why opt-in (gated on TWO conditions)

The auto-derive only fires when:

1. The plan declares `omp_execution: workflow` (Phase 1's top-row
   guard + Phase 2's b-plan rules apply).
2. The upstream `b-grill*` session produced at least one
   `decision_domain` (a casual "pre-flight" interview that concluded
   `boundary_assessment: cohesive` does NOT trigger).

A casual grilling session that produces zero domains does not
trigger the auto-derive. This is the deliberate opt-in per the
phase file's risk section.

## Slug collision rule

Two domains that kebab-case to the same value would produce
duplicate `PHASES` entries. Mitigation: append `-2`, `-3`, etc. to
subsequent collisions. The F6 template assumes slugs are unique
within `PHASES`.

## Verification (run before yielding)

- `npx vitest run` → 163/163 passing.
- `grep -F "## Feeding the workflow-kernel cell" skills/b-grill-me/SKILL.md skills/b-grill-with-docs/SKILL.md` → both files have the section.
- `grep -F "decision_domains → PHASES" docs/eval-kernel.md` → subsection present.
- `head -3 .context/2026-06-06.omp-integration-buck-workflow/index.md` → `status: completed`.

## Risk acknowledged, not mitigated further

- **The mapping depends on `decision_domains` shape stability.** If
  a future revision of `b-grill-me` adds fields like `complexity:`
  per domain, the mapping is wrong. Mitigation: a "Schema stability
  note" in both `b-grill*` skill sections explicitly tells future
  agents to treat the frontmatter schema in `## Session File` as
  the source of truth.
- **The judge prompt's per-domain phrasing** could read as "per
  phase" to the LLM. Mitigation: the docs and the section both say
  "name the domains explicitly" — the auto-derive emits a
  `build_prompt()` that includes `domain.name` literally.
- **The b-flow deprecation lesson**: Phase 4 is a new skill
  **section**, not a new skill or extension. The risk is that
  someone later re-runs this work and adds a new skill.
  Mitigation: the new section's title is "Feeding the
  workflow-kernel cell", not "b-phase-kernel" — the title keeps the
  relationship clear, and the parent plan's "Out of scope" list
  explicitly excludes a new skill.

## Cross-references

- Plan: `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel.md`
- Phase file: `.context/2026-06-06.omp-integration-buck-workflow/phase-4-b-grill-integration.md`
- Phased overview: `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md`
- Phase 1 memory: `.context/memory/cross-harness-kernel-phase-1-2026-06-07.md`
- Phase 2 memory: `.context/memory/cross-harness-kernel-phase-2-2026-06-07.md`
- Phase 3 memory: `.context/memory/cross-harness-kernel-phase-3-2026-06-07.md`
- Contract doc: `docs/eval-kernel.md`
