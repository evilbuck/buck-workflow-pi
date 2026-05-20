---
date: 2026-05-20
domains: [implementation, skill, docs, workflow]
topics: [b-explore, b-research, crawl4ai, research-source-dictionary, subject-index, buck-workflow, split]
subject: 2026-05-20.b-research-b-explore-split
artifacts: [plan-b-research-b-explore-split.md, tasks.md, index.md, draft-commit.md]
related: [prompt-to-skill-portability-plan-2026-05-12.md, global-agents-buck-workflow-mode-build-2026-05-17.md]
priority: high
status: completed
---

# Session: 2026-05-20 - b-explore / b-research split (plan + build)

## Context
- User asked for `/b-plan` against `TASK.md` to split current `b-research` into two commands.
- After planning, ran `/b-build` to implement all 8 tasks.

## Decisions Made
- **Skills-first split**: `b-explore` handles codebase exploration, `b-research` handles external/web research.
- **Compatibility preserved**: `research-*.md` stays the canonical summary artifact for all Buck consumers.
- **`index.md` additive**: subject folders gain an entrypoint; existing subjects without it continue to work.
- **No new extension**: only minimal edits to existing `extensions/index.ts` for plan-mode command list.
- **Source dictionary externalized**: `docs/research-source-dictionary.md` is maintained separately from skills for independent updates. Referenced by b-research.
- **User requested source dictionary**: during build, user suggested a list of research sources (Reddit, HN, forums, etc.). Created as a standalone file outside the skill for active maintenance.

## Implementation Notes
- Created: `skills/b-explore/SKILL.md`, `skills/crawl4ai/SKILL.md`, `prompts/b-explore.md`, `docs/research-source-dictionary.md`
- Rewrote: `skills/b-research/SKILL.md`, `prompts/b-research.md`
- Updated consumers: `b-plan`, `b-brainstorm`, `b-present`, `b-review` — all read `index.md` first and know about both commands
- Updated docs: `docs/buck-workflow.md` — Research Phase → Discovery Phase, split diagrams/tables, added b-explore throughout
- Updated: `README.md` — command table and skill inventory
- Updated: `extensions/index.ts` — `PLAN_MODE_COMMANDS` now includes `b-explore`
- All tasks completed, all verification checks passed

## Files Modified
- `skills/b-explore/SKILL.md` (new)
- `skills/b-research/SKILL.md` (rewritten)
- `skills/crawl4ai/SKILL.md` (new)
- `prompts/b-explore.md` (new)
- `prompts/b-research.md` (updated)
- `docs/research-source-dictionary.md` (new)
- `skills/b-plan/SKILL.md` (updated)
- `skills/b-brainstorm/SKILL.md` (updated)
- `skills/b-present/SKILL.md` (updated)
- `skills/b-review/SKILL.md` (updated)
- `docs/buck-workflow.md` (updated)
- `README.md` (updated)
- `extensions/index.ts` (updated)

## Abandoned Approaches
- Considered embedding source catalog directly in b-research skill — rejected in favor of standalone dictionary for easier maintenance
- Considered phasing via `/skill:b-phase` — not needed; 8 tasks were manageable in one build session

## Next Steps
- Commit the changes using the draft commit message
- Run `/b-review` if desired before committing
