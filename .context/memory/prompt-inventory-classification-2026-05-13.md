---
date: 2026-05-13
domains: [planning, docs, research]
topics: [prompts, skills, inventory, classification, portability]
subject: 2026-05-12.prompt-to-skill-portability
artifacts: [inventory-prompts.md]
related: [prompt-to-skill-portability-plan-2026-05-12.md]
priority: high
status: active
---

# Session: 2026-05-13 - Prompt Inventory & Classification

## Context
- Previous work: Plan created on 2026-05-12 identifying prompt-to-skill portability as a goal
- Goal: Execute on the prerequisite gap — create a complete inventory of all 9 prompts, classify each, identify runtime commands, and flag duplicates

## Decisions Made
- **7 of 9 prompts classified as Canonical Skill**: b-brainstorm, b-build, b-build-hard, b-iterate, b-plan, b-research, b-review — all are agent-agnostic workflow instruction sets
- **b-present classified as Thin Wrapper**: It explicitly delegates to the existing `skills/b-present/SKILL.md` skill
- **git-commit classified as Canonical Skill**: Standalone utility, agent-agnostic, but outside the b-* chain
- **All 6 runtime commands are extension-only**: b-save, b-flow, plan mode, model auto-switch, session state tracking, tmux window status — none can become skills

### User Decisions (2026-05-13)
- **#1 Merge b-build + b-build-hard**: Yes, into one parametric skill with difficulty parameter
- **#2 git-commit**: Standalone skill that also works with buck-workflow
- **#3 b-present prompt**: Keep as thin wrapper — quicker and explicit
- **#4 $ARGUMENTS**: Skills get raw text only; prompts have full positional args ($1, $@, etc.). Architecture must be skill+prompt pair for anything taking user arguments
- **#5 Grill consolidation**: Merge b-grill-me + b-grill-auto into one skill with mode parameter. Keep b-grill-with-docs separate.

## Implementation Notes
- Key artifact: `.context/2026-05-12.prompt-to-skill-portability/inventory-prompts.md`
- Total prompt lines: 1,085 across 9 files
- Total skill lines: 1,321 across 6 skills
- One known duplicate: `prompts/b-present.md` ↔ `skills/b-present/SKILL.md`
- 5 unresolved decisions flagged for user review (merge b-build/b-build-hard, git-commit fate, b-present elimination, $ARGUMENTS handling, grill skill consolidation)

## Next Steps
- [x] Resolve the 5 unresolved decisions with user
- [ ] Proceed with creating canonical skills for the 7 classified prompts
- [ ] Merge b-build + b-build-hard into parametric skill
- [ ] Merge b-grill-me + b-grill-auto into parametric skill
- [ ] Create git-commit as standalone skill
- [ ] Reduce b-present prompt to thin wrapper (remove duplicated sections)
- [ ] Consider b-phase before implementation (touches multiple surfaces)
