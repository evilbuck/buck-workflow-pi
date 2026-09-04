---
status: completed
date: 2026-09-04
domains: [skill, buck-workflow, docs]
topics: [b-nasa-prd, nasa, prd, requirements, skill-creation]
related: [research-nasa-appendix-c.md]
research: [research-nasa-appendix-c.md]
memory: [../memory/b-nasa-prd-skill-2026-09-04.md]
priority: medium
---

# Plan: Build the b-nasa-prd skill

**Goal**: Distill NASA SEH Appendix C into a `b-nasa-prd` skill that authors and audits PRDs to NASA's requirement-quality standard, with the source document bundled locally.

## Deliverables and acceptance criteria

1. **Local source copy** — `skills/b-nasa-prd/references/nasa-appendix-c.md`: verbatim C.1–C.4 content + provenance (URL, pull date, license note). ✅
2. **Distilled checklist** — `references/requirement-quality-checklist.md`: every C.1–C.4 rule mapped to a citable ID; PRD vocabulary mapping table; banned-word quick scan. ✅
3. **SKILL.md** — frontmatter (`name`, `description`); five-line standard summary; author mode (intake → draft → validate → emit PRD with requirements table: ID / shall-statement / rationale / verification / trace-to); review mode (audit with rule IDs, findings table, blocker/warn severities, no silent rewrite); workflow position (`b-research → b-nasa-prd → b-plan`). ✅
4. **Prompt wrapper** — `prompts/b-nasa-prd.md` (thin wrapper convention: description frontmatter, `$ARGUMENTS`, load skill path). ✅
5. **OMP command mirror** — `commands/b-nasa-prd.md` symlink → `../prompts/b-nasa-prd.md`. ✅
6. **Live-session surface** — `~/.agents/skills/b-nasa-prd` symlink → repo `skills/b-nasa-prd/` (matches every sibling b-* skill). ✅
7. **README catalog** — row in Prompt Templates table + row in Skills table; tail verified intact after edit (README edit-safety rule). ✅
8. **docs/buck-workflow.md** — Quick Reference Table row + detailed section at end of Discovery Phase. ✅
9. **Durable state** — subject folder `2026-09-04.b-nasa-prd-skill/` + session memory + memory index entry. ✅

## Non-goals

- No SEH sibling appendices (D/E) or full-handbook PDF pulled — Appendix C is the complete basis of the standard.
- No extension code, no scripts — pure markdown skill per the three-layer model.
- No changes to b-plan/b-grill (b-nasa-prd composes with them; integration is documented, not wired).

## Verification

- `commands/b-nasa-prd.md` resolves and cats the wrapper body.
- `~/.agents/skills/b-nasa-prd` resolves to the skill directory.
- README tail (Requirements/Compatibility/License) intact after table insert.
- Session is docs-only (all changed paths `.md` / `.context/`) → deterministic check contract skipped by rule.
