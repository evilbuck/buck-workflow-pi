---
date: 2026-05-17
domains: [research, extensions]
topics: [plan-mode, write-guards, b-grill-me, b-grill-with-docs, isAllowedPlanWritePath]
subject: 2026-05-17.planning-mode-write-guards
artifacts: [research-planning-mode-guards.md]
related: [b-orchestration-extension-2026-05-08.md, prompt-to-skill-build-2026-05-13.md]
priority: high
status: active
---

## Context

User reported b-research sessions implementing half-baked solutions mid-research. The existing plan mode in `extensions/index.ts` has gaps that allow writes to source files.

## Key Findings

1. `PLAN_MODE_COMMANDS` missing `b-grill-me` and `b-grill-with-docs`
2. `isAllowedPlanWritePath()` too permissive — `.md`/`.txt` extension allowlist allows writes to `src/*.md`
3. No prompt templates for grill commands — they're skill-only, so `/b-grill-me` command doesn't trigger plan mode
4. Skill loading via `/skill:b-research` bypasses command handler entirely

## Decisions Made

- Restrict writes to `.context/` and `docs/` paths only (remove extension-based allowlist)
- Create prompt templates for `b-grill-me` and `b-grill-with-docs`
- Add both to `PLAN_MODE_COMMANDS`

## Verification

- Traced full plan mode flow: command registration → enablePlanMode() → before_agent_start injection → tool_call blocking
- Confirmed `isAllowedPlanWritePath` uses both path prefix AND extension checks (the extension check is the gap)

## Next Steps

- Write plan for the 4 changes (or go straight to b-build since scope is small)
