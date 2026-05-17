---
date: 2026-05-17
domains: [buck-workflow, plan-mode, write-guards, extensions, keybindings]
topics: [plan-mode, write-guards, grill-commands, prompt-templates, isAllowedPlanWritePath, alt+p, toggle, keybind]
subject: 2026-05-17.planning-mode-write-guards
artifacts: [research-planning-mode-guards.md, draft-commit.md]
related: []
priority: medium
status: completed
---

## Context

User reported last two sessions had b-research implementing half-baked solutions mid-research. Research (`.context/2026-05-17.planning-mode-write-guards/research-planning-mode-guards.md`) identified 4 gaps in plan mode write guards. During implementation, user also requested a manual toggle via `alt+p` keybinding.

## Decisions Made

1. Add `b-grill-me` and `b-grill-with-docs` to `PLAN_MODE_COMMANDS` — plan mode now activates during grilling sessions
2. Create prompt templates for grill commands so they register as proper Pi commands (triggering the extension hook)
3. Remove `.md`/`.txt` extension-based allowlist from `isAllowedPlanWritePath` — only `.context/` and `docs/` paths pass now
4. Update all user-facing messages to reflect tighter scope
5. Add `alt+p` keybinding to toggle plan mode on/off — configurable via `keybindings.json`

## Implementation Notes

### Changed Files
- `extensions/index.ts` — 6 edits in initial build + toggle keybind addition:
  - Added `b-grill-me`, `b-grill-with-docs` to `PLAN_MODE_COMMANDS`
  - Removed `PLAN_MODE_ALLOWED_EXTENSIONS` constant
  - Tightened `isAllowedPlanWritePath()` to path-prefix-only check
  - Updated `enablePlanMode()` notify message
  - Updated `before_agent_start` system prompt (removed `.md/.txt` references, added `.md/.txt outside .context/ and docs/` to blocked list)
  - Simplified write/edit block reasons to single message
  - Added `togglePlanMode()` function for keybind
  - Registered `pi.registerShortcut("alt+p", ...)` for manual toggle
- `prompts/b-grill-me.md` — New prompt template for `/b-grill-me` command
- `prompts/b-grill-with-docs.md` — New prompt template for `/b-grill-with-docs` command

### What was NOT changed
- Skill files (b-grill-me/SKILL.md, b-grill-with-docs/SKILL.md) — write guards enforced at extension level
- Bash guard patterns — already working (redirects blocked, AI review for ambiguous)
- `/skill:b-research` path — known edge case, deferred; primary flow via `/b-research` command works

## Verification

- All grep checks confirmed correct changes
- `PLAN_MODE_COMMANDS` includes both grill commands
- `PLAN_MODE_ALLOWED_EXTENSIONS` constant fully removed
- `isAllowedPlanWritePath` only checks `.context/` and `docs/` prefixes
- Block reasons and notify messages updated consistently
- `togglePlanMode` function reads/writes state, toggles, updates status bar
- `pi.registerShortcut("alt+p", ...)` registered with description

## Next Steps

- Test `/b-grill-me` and `/b-grill-with-docs` to confirm plan mode activates in status bar
- Test `alt+p` to confirm manual toggle works
- Consider adding `/skill:` path detection as future enhancement
- Consider whether `b-review` should disable plan mode
