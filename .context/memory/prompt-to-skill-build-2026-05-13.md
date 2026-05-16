---
date: 2026-05-13
domains: [implementation, refactoring, skills]
topics: [prompts, skills, portability, b-build, b-build-hard, b-brainstorm, b-iterate, b-plan, b-research, b-review, git-commit, b-grill]
subject: 2026-05-12.prompt-to-skill-portability
artifacts: [skills/b-build/SKILL.md, skills/b-brainstorm/SKILL.md, skills/b-iterate/SKILL.md, skills/b-plan/SKILL.md, skills/b-research/SKILL.md, skills/b-review/SKILL.md, skills/git-commit/SKILL.md, skills/b-grill/SKILL.md]
related: [prompt-inventory-classification-2026-05-13.md, prompt-to-skill-portability-plan-2026-05-12.md]
priority: high
status: active
---

# Session: 2026-05-13 - Prompt to Skill Conversion Build

## Context
- Previous work: Inventory and classification completed on 2026-05-13. All 5 user decisions resolved.
- Goal: Create canonical skills from prompt-only workflows, then convert prompts to thin wrappers

## Decisions Made
- **Merging b-build + b-build-hard** into `skills/b-build/SKILL.md` with difficulty parameter
- **Merging b-grill-me + b-grill-auto** into `skills/b-grill/SKILL.md` with mode parameter
- **Keeping b-grill-with-docs** as separate skill (updated references to point to merged base)
- **git-commit** → standalone `skills/git-commit/SKILL.md`
- **b-present prompt** stays as thin wrapper, skill is already canonical (already existed)
- **Skills receive raw text args only**; prompts needed as wrappers for $ARGUMENTS parsing

## Files Modified
### New Skills Created
- `skills/b-build/SKILL.md` (131 lines) — merged b-build + b-build-hard with difficulty parameter
- `skills/b-brainstorm/SKILL.md` (126 lines)
- `skills/b-iterate/SKILL.md` (78 lines)
- `skills/b-plan/SKILL.md` (170 lines)
- `skills/b-research/SKILL.md` (70 lines)
- `skills/b-review/SKILL.md` (100 lines)
- `skills/git-commit/SKILL.md` (101 lines)
- `skills/b-grill/SKILL.md` (333 lines) — merged b-grill-me + b-grill-auto with mode parameter

### Thin Wrappers (converted from full prompt bodies)
- `prompts/b-build.md` (5.6KB → 213B)
- `prompts/b-build-hard.md` (5.5KB → 213B)
- `prompts/b-brainstorm.md` (4.6KB → 234B)
- `prompts/b-iterate.md` (3.4KB → 174B)
- `prompts/b-plan.md` (6.5KB → 251B)
- `prompts/b-research.md` (2.3KB → 233B)
- `prompts/b-review.md` (3.2KB → 214B)
- `prompts/git-commit.md` (3.7KB → 181B)
- `prompts/b-present.md` (4.8KB → 458B) — already was a partial wrapper, cleaned up

### Updated
- `skills/b-grill-with-docs/SKILL.md` — updated references from b-grill-me to b-grill

### Assets Moved
- `skills/b-grill/grill.py` — copied from b-grill-auto

## Remaining Tasks
- [ ] Add or document Claude Code, OpenCode, and Codex command/plugin adapter strategy
- [ ] Update README/AGENTS documentation for the layered architecture
- [ ] Verify representative workflows through direct skill invocation and command wrappers
- [ ] Consider removing old `skills/b-grill-me/` and `skills/b-grill-auto/` directories (backward compat)

## Next Steps
- Run `/b-review` to validate the conversion
- Then `/b-save` to finalize
