---
date: 2026-05-13
domains: [planning, docs]
topics: [prompts, skills, portability, inventory, handoff]
subject: 2026-05-12.prompt-to-skill-portability
related: [plan-prompt-to-skill-portability.md, tasks.md]
priority: high
status: active
---

# Handoff: Create Prompt Inventory (Critical Prerequisite)

## What This Handoff Addresses

**Critical gap in `plan-prompt-to-skill-portability.md`**: The plan correctly identifies "inventory every prompt" as Step 1, but:
- No inventory artifact exists yet
- Classification criteria are not concrete
- Implementation passes will argue about which prompts become skills

**This handoff drives a separate agent to create the inventory artifact before phasing begins.**

---

## Source Files (Read Only)

### Prompts Directory
Location: `prompts/` (9 files)

| File | Purpose |
|------|---------|
| `b-brainstorm.md` | Workflow prompt |
| `b-build.md` | Workflow prompt |
| `b-build-hard.md` | Workflow prompt |
| `b-iterate.md` | Workflow prompt |
| `b-plan.md` | Workflow prompt |
| `b-present.md` | Workflow prompt |
| `b-research.md` | Workflow prompt |
| `b-review.md` | Workflow prompt |
| `git-commit.md` | Workflow prompt |

### Skills Directory
Location: `skills/` (6 directories)

| Directory | Status |
|-----------|--------|
| `b-grill-auto/` | Existing skill |
| `b-grill-me/` | Existing skill |
| `b-grill-with-docs/` | Existing skill |
| `b-phase/` | Existing skill |
| `b-present/` | Existing skill (potential duplicate of `prompts/b-present.md`) |
| `run-in-idle-pane/` | Existing skill |

### Reference Documentation
- `AGENTS.md` — Documents current skill/prompt/extension targets
- `README.md` — May contain existing command mapping (check)

---

## Classification Criteria (Do Not Deviate)

Each prompt must be classified into ONE category:

| Category | Definition | Action |
|----------|------------|--------|
| **Canonical Skill** | Reusable workflow instruction set (could run in any agent) | Convert to `skills/<name>/SKILL.md` |
| **Thin Wrapper** | Calls a canonical skill with agent-specific argument passing | Keep as `prompts/<name>.md` reduced to ~10 lines |
| **Runtime Automation** | Needs event hooks, session state, persistence, or custom tools | Keep as extension/plugin only |
| **One-off Helper** | Rarely used, agent-specific, not reusable | Document and leave as-is |
| **Undecided** | Needs discussion or user decision | Flag for review |

---

## Required Output Artifact

Create: `.context/2026-05-12.prompt-to-skill-portability/inventory-prompts.md`

Format:
```markdown
---
date: YYYY-MM-DD
status: active
subject: 2026-05-12.prompt-to-skill-portability
---

# Inventory: Prompts → Skills Classification

## Classification Criteria
[Reference this handoff's table]

## Inventory

| Prompt | Current Location | Proposed Classification | Rationale | Owner |
|--------|------------------|------------------------|-----------|-------|
| b-brainstorm | prompts/b-brainstorm.md | Canonical Skill / Thin Wrapper / Runtime / Helper / Undecided | [1-2 sentence rationale] | [agent or user] |
| ... | ... | ... | ... | ... |

## Known Duplicates
- `prompts/b-present.md` vs `skills/b-present/` — [resolution]
- [Other duplicates]

## Runtime Commands (Not in prompts/)
| Command | Current Implementation | Classification | Notes |
|---------|----------------------|----------------|-------|
| b-save | [where is this implemented?] | Runtime Automation | [notes] |
| ... | ... | ... | ... |

## Unresolved Decisions
- [List of questions requiring user or review decisions]
```

---

## Execution Steps

1. Read all 9 prompt files in `prompts/`
2. Read all 6 existing skill `SKILL.md` files in `skills/`
3. Identify `b-save` and other runtime commands (check `AGENTS.md`, README, package.json)
4. Classify each prompt per the table above
5. Note any duplication (especially `b-present`)
6. Flag unclear cases as "Undecided"
7. Write `inventory-prompts.md` with classification table

---

## Exit Criteria

- [ ] `inventory-prompts.md` exists in `.context/2026-05-12.prompt-to-skill-portability/`
- [ ] All 9 prompts are classified
- [ ] Runtime commands are identified and classified
- [ ] Duplicates are flagged
- [ ] At least one "Unresolved Decisions" section item exists (if genuinely uncertain)

---

## Reference to Existing Artifacts

Do NOT copy content from these files. Reference them:

| File | Reference |
|------|-----------|
| `plan-prompt-to-skill-portability.md` | Source plan, step #1 calls for inventory |
| `tasks.md` | Task #1 is the inventory task |
| `prompts/*.md` | Source prompts to classify |
| `skills/*/SKILL.md` | Existing skills for comparison |
| `AGENTS.md` | Current targets documentation |
