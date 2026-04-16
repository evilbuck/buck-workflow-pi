---
date: 2026-04-16
domains: [docs, tooling]
topics: [pi-packages, opencode-mapping, buck-workflow, prompt-templates, extensions]
subject: 2026-04-16.pi-opencode-mapping
artifacts: [plan-pi-opencode-mapping.md, todo.md]
related: []
priority: high
status: completed
---

# Session: 2026-04-16 - Pi/OpenCode Mapping Docs Alignment

## Context
- Goal: align Buck workflow package docs with Pi-native primitives after reviewing how OpenCode concepts map to Pi.
- Active plan: `.context/2026-04-16.pi-opencode-mapping/plan-pi-opencode-mapping.md`

## Decisions Made
- Documented Buck workflow in Pi as a unified `/b-*` surface backed by multiple primitives rather than a single command-file system.
- Clarified that most `/b-*` entrypoints are prompt templates.
- Documented `/b-save` as an extension-registered command implemented in `extensions/index.ts`.
- **Second pass decisions:**
  - Removed all per-command OpenCode config blocks (Command File, Agent Config, model, temperature, mode, permissions JSON) from the detailed sections, replacing them with a single `**Pi primitive**:` line.
  - Consolidated historical OpenCode config into a dedicated "Historical Reference: OpenCode Configuration" section at the bottom of `docs/buck-workflow.md` with a translation table.
  - Removed `memory-manager` skill entirely (deleted `skills/memory-manager/` directory and removed from README table).
  - Removed OpenCode-specific "Discoverability" subsections (subagents, primary agents via `/agent`).
  - Updated model routing descriptions to be Pi-agnostic (no more `opencode.jsonc` references).
  - Updated version footer and removed chezmoi source-file references.

## Implementation Notes
- **Pass 1**: Added Pi-native mapping section to README and docs; reframed OpenCode references as lineage.
- **Pass 2**: Purged all remaining OpenCode-native config tables from detailed component docs. Collapsed historical config into a single appendix section. Removed deprecated `memory-manager` skill entirely.
- No code/runtime behavior changed; documentation-only passes.

## Files Modified
- `README.md` — added Pi-native mapping, removed deprecated `memory-manager` skill entry
- `docs/buck-workflow.md` — removed 10 OpenCode config blocks, added historical reference appendix, cleaned Discoverability section, updated model routing descriptions, removed Sources footer
- `skills/memory-manager/` — deleted entirely
- `.context/2026-04-16.pi-opencode-mapping/plan-pi-opencode-mapping.md`
- `.context/2026-04-16.pi-opencode-mapping/todo.md`
- `.context/memory/pi-opencode-mapping-2026-04-16.md`
- `.context/memory/index.md`

## Next Steps
- None remaining from this subject. All todo items completed.
