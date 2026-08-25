---
date: 2026-08-23
domains: [docs, buck-workflow, memory]
topics: [memory-search, omp, qmd, b-save, agents-bootstrap]
subject: 2026-08-23.memory-search-agnostic
artifacts: [plan-memory-search-agnostic.md, draft-commit.md, index.md]
related: []
priority: medium
status: completed
---

# Conditional memory search

Implemented and saved `.context/2026-08-23.memory-search-agnostic/plan-memory-search-agnostic.md`.

## Decision

Prior-work search is a harness conditional, not a flat OMP → qmd → ledger list.

- **OMP**: `recall` / `reflect` (search) and `retain` / `learn` (`/b-save` step 8)
- **Non-OMP**: load the skill path in project `AGENTS.md` under `## Memory Search Tool`
- **Fallback**: `.context/memory/index.md`

This project's configured path: `~/.agents/skills/qmd/SKILL.md`.

`/b-save` step 8 is OMP-only. Step 9 is non-OMP memory-skill re-index only.

## Files modified

- `GLOBAL_OR_PROJECT-AGENTS.md` — conditional search + configuration examples
- `AGENTS.md` — memory layers + `## Memory Search Tool`
- `prompts/b-save.md` — step 8 OMP-only, step 9 configured skill re-index
- `skills/b-save/SKILL.md` — same contract (canonical skill; not listed in the plan)
- `skills/b-explore/SKILL.md` — same search conditional
- `README.md` — requirements + `/b-save` descriptions
- `docs/buck-workflow.md` — step 9 + memory-layer table
- `docs/oh-my-pi.md` — prior-work search one-liner

## Verification

Docs-only session — skipped `/b-guardrails-check`. Manual review of the eight files: no leftover "optional qmd" / "QMD re-index" / "first match wins" language.

README Pure Prompt Commands table was briefly corrupted (header replaced) and restored.

## Save notes

- No spec. No phases. No `iterate-*.md`.
- Plan has `## User Goal`.
- Deferred: other skills (`b-build`, `b-plan`, `b-iterate`, …) may still mention qmd as a universal fallback. Tracked as backlog item `qmd-mentions-outside-plan`.
