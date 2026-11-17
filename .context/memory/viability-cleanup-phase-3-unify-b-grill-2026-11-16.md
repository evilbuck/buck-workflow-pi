---
date: 2026-11-16
domains: [skills, refactor, docs, testing]
topics: [viability-cleanup, b-grill, b-grill-me, b-grill-with-docs, domain-docs, consolidation]
subject: 2026-10-01.skill-command-viability
artifacts:
  - plan-viability-cleanup.md
  - plan-viability-cleanup-phases.md
  - phase-3-grill-shell.md
  - draft-commit.md
related:
  - .context/memory/viability-cleanup-phase-2-fold-duplicates-2026-11-16.md
priority: high
status: completed
---

# Viability Cleanup Phase 3: Unify b-grill Family with Domain Docs by Default (G1)

## User Goal

Execute Phase 3 (G1) of the viability cleanup plan: consolidate `b-grill`, `b-grill-me`, and `b-grill-with-docs` into a single canonical `skills/b-grill/` with domain documentation (`CONTEXT.md` + `docs/adr/`) enabled by default in user mode and `--no-docs` to opt out.

## What shipped

- **G1 (`b-grill` + `b-grill-me` + `b-grill-with-docs` → `b-grill`)**:
  - Relocated `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` from `skills/b-grill-with-docs/` into `skills/b-grill/` (and synced `plugins/buck-workflow/skills/b-grill/`).
  - Rewrote `skills/b-grill/SKILL.md` to merge the `workflow_state` access header, default domain-doc awareness (`CONTEXT.md` + `docs/adr/` challenge, glossary sharpening, inline updates) with `--no-docs` opt-out, Jev `turn_class` classification (`direct_answer`, `addendum`, `arbitrary`), Material Decision Closeout, Metadata Tracking, Session File (`## Documentation Decisions`, `## Addenda`, `## Parked`), Document Mode, Workflow-Kernel Cell `PHASES` auto-derive, and `--mode user|auto` (`grill.py`).
  - Updated `skills/b-docs/SKILL.md` (and its Codex copy), `GLOBAL_OR_PROJECT-AGENTS.md`, `THIRD-PARTY-NOTICES.md`, and `docs/buck-workflow.md` to reference `b-grill/CONTEXT-FORMAT.md` and `b-grill/ADR-FORMAT.md`.
  - Repointed `prompts/b-grill-me.md` and `prompts/b-grill-with-docs.md` to load `../skills/b-grill/SKILL.md`.
  - Deleted `skills/b-grill-me/`, `skills/b-grill-with-docs/`, `plugins/buck-workflow/skills/b-grill-me/`, and `plugins/buck-workflow/skills/b-grill-with-docs/`, and updated `scripts/codex-plugin.test.ts` and `README.md`.

## Verification

- `npm run guardrails:check` passed (`status: pass`, coverage 88.3%, complexity 27 hotspots vs 30 baseline, 0 new violations).
- `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts scripts/skill-frontmatter.test.ts extensions/index.test.ts` passed (4 files, 25 tests).

- `.context/2026-10-01.skill-command-viability/phase-3-grill-shell.md` — skills/b-grill/SKILL.md:1-125, skills/b-grill/ADR-FORMAT.md:1-10, skills/b-grill/CONTEXT-FORMAT.md:1-10, prompts/b-grill-me.md:1-14, prompts/b-grill-with-docs.md:1-14, and npm run guardrails:check (status: pass)
