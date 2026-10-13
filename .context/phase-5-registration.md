---
status: completed
phase: 5
order: 5
plan: plan-b-init-guardrails.md
phases_overview: plan-b-init-guardrails-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine — mechanical registration
buck_hint: /b-build
goal: Wire prompt wrappers, command symlinks, docs registration, and file the eval-kernel backlog item.
files:
  - prompts/b-init-guardrails.md
  - prompts/b-guardrails-check.md
  - commands/b-init-guardrails.md
  - commands/b-guardrails-check.md
  - docs/buck-workflow.md
  - .context/backlog/items/eval-kernel-doc-gap-async-task.md
  - .context/backlog/todo.md
from_plan_steps: [8, 9]
depends_on: [3, 4]
dependency_type: HARD
acceptance_criteria:
  - "[ ] prompts/b-init-guardrails.md and prompts/b-guardrails-check.md exist with correct frontmatter"
  - "[ ] commands/b-init-guardrails.md and commands/b-guardrails-check.md are symlinks to the prompts"
  - "[x] prompts/b-init-guardrails.md and prompts/b-guardrails-check.md exist with correct frontmatter"
  - "[x] commands/b-init-guardrails.md and commands/b-guardrails-check.md are symlinks to the prompts"
  - "[x] Both prompts load the correct skill by path (../skills/b-init-guardrails/SKILL.md, ../skills/b-guardrails-check/SKILL.md)"
  - "[x] docs/buck-workflow.md Quick Reference Table includes both skills"
  - "[x] Backlog item for eval-kernel doc-gap already exists (filed earlier this session)"
  - "[x] b-init-guardrails backlog item updated to reflect build progress"
---
completed_at: 2026-07-26
# Phase 5: Registration

## Context

Parent plan's user goal: a developer in any codebase runs one command and gets quality guardrails with a brownfield ratchet and non-blocking subagent checks.

This phase wires the cross-harness registration so the skills are discoverable and invokable. It also files the eval-kernel doc-gap backlog item identified during research (the live OMP `task` tool's async capability is undocumented in `docs/eval-kernel.md`).

This phase HARD-depends on Phase 3 and Phase 4 (the prompts load the skills by path).

## Implementation Details

From the parent plan, steps 8 and 9:

### Step 8: Wire Registration

#### 8a: Create prompt wrappers

Create `prompts/b-init-guardrails.md`:

```markdown
---
description: One-shot, idempotent initialization of quality guardrails (tests, coverage, cyclomatic complexity) with a brownfield ratchet.
---

# B-INIT-GUARDRAILS

$ARGUMENTS

Load and follow the `b-init-guardrails` skill (sibling skills tree — resolve relative to this prompt file's location, not the target repo):

```
../skills/b-init-guardrails/SKILL.md
```
```

Create `prompts/b-guardrails-check.md`:

```markdown
---
description: Measure coverage and cyclomatic complexity, compare against guardrails.json gates, and return a structured verdict. Measures and reports only — never edits.
---

# B-GUARDRAILS-CHECK

$ARGUMENTS

Load and follow the `b-guardrails-check` skill (sibling skills tree — resolve relative to this prompt file's location, not the target repo):

```
../skills/b-guardrails-check/SKILL.md
```
```

#### 8b: Create command symlinks

From the repo root:

```bash
ln -s ../prompts/b-init-guardrails.md commands/b-init-guardrails.md
ln -s ../prompts/b-guardrails-check.md commands/b-guardrails-check.md
```

Verify the symlinks resolve:

```bash
ls -la commands/b-init-guardrails.md
ls -la commands/b-guardrails-check.md
```

Both should show `-> ../prompts/b-init-guardrails.md` and `-> ../prompts/b-guardrails-check.md`.

#### 8c: Register in docs/buck-workflow.md

Read `docs/buck-workflow.md` and find the Quick Reference Table. Add two rows:

```markdown
| `/b-init-guardrails` | One-shot, idempotent initialization of quality guardrails (tests, coverage, cyclomatic complexity) with a brownfield ratchet. Detects the stack, measures the baseline, proposes tooling, writes guardrails.json, and installs a managed AGENTS.md block. | skills/b-init-guardrails/SKILL.md |
| `/b-guardrails-check` | Measure coverage and cyclomatic complexity, compare against guardrails.json gates, and return a structured verdict. Invokable standalone or dispatched as a subagent by the mainline agent. Measures and reports only — never edits. | skills/b-guardrails-check/SKILL.md |
```

Insert in alphabetical order within the table.

### Step 9: File Eval-Kernel Doc-Gap Backlog Item

During research (`research-harness-gate-mechanics.md` Finding 2), we discovered that the live OMP `task` tool's async capability is undocumented in `docs/eval-kernel.md`. File a backlog item to track this follow-up.

#### 9a: Create the backlog item file

Create `.context/backlog/items/eval-kernel-doc-gap-async-task.md`:

```yaml
---
title: Document OMP async task capability in eval-kernel.md
status: active
priority: medium
created: 2026-07-26
updated: 2026-07-26
completed: null
related:
  - docs/eval-kernel.md
  - skills/b-guardrails-check/SKILL.md
  - .context/2026-07-26.b-init-guardrails/research-harness-gate-mechanics.md
---

# Document OMP async task capability in eval-kernel.md

## Context

During b-init-guardrails research (`research-harness-gate-mechanics.md` Finding 2), we discovered that the live OMP `task` tool is genuinely async (fire-and-forget + auto-delivery), but this capability is undocumented in `docs/eval-kernel.md`.

The b-guardrails-check skill (Phase 4) references this capability for async dispatch, but the contract is not formally documented.

## Scope

Update `docs/eval-kernel.md` to document:
1. The `task` tool's async dispatch capability (fire-and-forget + auto-delivery)
2. The runtime detection rule (OMP async vs. portable blocking)
3. The auto-delivery contract (verdict auto-delivers when ready; no polling needed)

## Acceptance Criteria

- [ ] `docs/eval-kernel.md` includes a section on async dispatch
- [ ] The `task` tool's fire-and-forget + auto-delivery behavior is documented
- [ ] The runtime detection rule is quoted from b-loop
- [ ] The auto-delivery contract is explicit

## Notes

This is a follow-up from the b-init-guardrails research phase. It is out of scope for the guardrails skills themselves but is a real gap in the eval-kernel documentation.
```

#### 9b: Add to todo.md

Read `.context/backlog/todo.md` and add a linked checkbox:

```markdown
- [ ] [Document OMP async task capability in eval-kernel.md](items/eval-kernel-doc-gap-async-task.md)
```

Insert in the appropriate section (or at the top if no sections exist).

## Risks

- **Symlink breakage**: if the prompts are moved, the symlinks break. Mitigation: verify symlinks resolve after creation.
- **Docs drift**: if `docs/buck-workflow.md` is restructured, the Quick Reference Table may move. Mitigation: grep for "Quick Reference" to find the table; if it's gone, ask the user where to register the skills.

## Verification

1. **Prompt files:**
   - [ ] `prompts/b-init-guardrails.md` exists with correct frontmatter
   - [ ] `prompts/b-guardrails-check.md` exists with correct frontmatter
   - [ ] Both prompts load the correct skill by path

2. **Command symlinks:**
   - [ ] `commands/b-init-guardrails.md` is a symlink to `../prompts/b-init-guardrails.md`
   - [ ] `commands/b-guardrails-check.md` is a symlink to `../prompts/b-guardrails-check.md`
   - [ ] Both symlinks resolve (cat the symlink, verify content matches the prompt)

3. **Docs registration:**
   - [ ] `docs/buck-workflow.md` Quick Reference Table includes both skills
   - [ ] Both rows have correct paths to the SKILL.md files

4. **Backlog item:**
   - [ ] `.context/backlog/items/eval-kernel-doc-gap-async-task.md` exists with proper frontmatter
   - [ ] `todo.md` includes the new item as a linked checkbox
   - [ ] The checkbox is unchecked (status: active)

5. **End-to-end invocation:**
   - [ ] `/b-init-guardrails` resolves and loads the skill
   - [ ] `/b-guardrails-check` resolves and loads the skill
   - [ ] `skill://b-init-guardrails` resolves to the SKILL.md
   - [ ] `skill://b-guardrails-check` resolves to the SKILL.md
