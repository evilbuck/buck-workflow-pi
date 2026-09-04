---
date: 2026-09-04
domains: [skill, buck-workflow, docs]
topics: [b-nasa-prd, nasa, prd, requirements, appendix-c, skill-creation]
related: []
priority: medium
status: completed
subject: 2026-09-04.b-nasa-prd-skill
artifacts:
  - skills/b-nasa-prd/SKILL.md
  - skills/b-nasa-prd/references/nasa-appendix-c.md
  - skills/b-nasa-prd/references/requirement-quality-checklist.md
  - prompts/b-nasa-prd.md
  - commands/b-nasa-prd.md
  - README.md
  - docs/buck-workflow.md
---

# b-nasa-prd skill built from NASA SEH Appendix C

User requested: pull the NASA "Appendix C: How to Write a Good Requirement" page locally and distill it into a `B-NASA-PRD` skill for writing the clearest PRDs to NASA standards.

## What shipped

- **`skills/b-nasa-prd/`** — canonical skill (three-layer model):
  - `references/nasa-appendix-c.md` — verbatim local copy of the source (C.1 terms, C.2 editorial, C.3 goodness, C.4 validation incl. 13 qualities and both banned-word lists) with provenance header; skill never refetches it
  - `references/requirement-quality-checklist.md` — distilled audit rules with citable IDs (TERM/ED/G/CLA/COM/CMP/CON/TRA/COR/FUN/PER/INT/MAI/REL/VER/DAT), NASA→PRD vocabulary mapping, banned-word quick scan
  - `SKILL.md` — author mode (intake → draft with `The <product> shall <verb> <object> <tolerance>` grammar → checklist validation → PRD emit with requirements table: ID/rationale/verification/trace) and review mode (rule-ID findings table, blocker/warn severities, no silent rewrite)
- **`prompts/b-nasa-prd.md`** + **`commands/b-nasa-prd.md`** symlink (OMP mirror) + `~/.agents/skills/b-nasa-prd` symlink (live-session surface, matches siblings)
- **Catalog rows**: README prompt-templates and skills tables; `docs/buck-workflow.md` quick-reference row + detailed section at end of Discovery Phase (workflow position: after `/b-research`, before `/b-plan`)

## Key design decisions

- One skill, not a set: the "set of skills" is realized as bundled references with progressive disclosure (SKILL.md lean; verbatim source + checklist on demand).
- Verification method is a per-requirement PRD table column — encodes NASA verifiability (VER-1) and traceability (TRA-3) as structure, not prose.
- TBR register replaces scattered TBDs (NASA G-4 protocol) as a first-class PRD section.
- README edits followed the edit-safety rule; tail re-verified intact after table inserts.

## Verification

- Symlinks resolve and wrapper body reads through `commands/b-nasa-prd.md`.
- README tail (Requirements/Compatibility/Contributing/License) present post-edit.
- Docs-only session (all changed paths `.md`/`.context/`) → deterministic check contract skipped per rule; no code gates apply.
