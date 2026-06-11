---
status: completed
date: 2026-06-11
subject: 2026-06-11.b-commit-final-step
topics: [b-commit, git-commit, workflow-surface, docs]
informs: [plan-b-commit-final-step.md]
---

# Research: current commit surface

## User request

Update Buck workflow so the final step is `b-commit`, implemented by running the existing `git-commit` skill. Goal/phase/body loop buffers should include commit as part of completion: each phase gets its own commit, and each workflow/body unit gets its own commit. Documentation, READMEs, and global AGENTS managed through chezmoi must be updated.

## Findings

### Existing command/skill shape

- `skills/git-commit/SKILL.md` is the implementation: Conventional Commit generation, protected-branch guard, reads `draft-commit.md`, commits immediately, verifies `git log -1`, and cleans up the draft.
- `prompts/git-commit.md` is only a thin wrapper that loads `skills/git-commit/SKILL.md`.
- `commands/git-commit.md` exists for OMP slash-command discovery.
- There is no `/b-commit` prompt or command today.

### Current workflow final step drift

Workflow docs and skills are inconsistent about whether commit is part of completion:

- `README.md` full and partial workflows currently end at `/b-save`, while `/git-commit` appears only in the command table.
- `docs/buck-workflow.md` OMP examples and flow diagrams end at `/b-save`; the b-phase skill already has some Ralph text that says `/b-save` then `/git-commit` before `ralph_done`.
- `skills/b-plan/SKILL.md` non-phased and phased Ralph instruction templates already include `/git-commit` after `/b-save`.
- `skills/b-phase/SKILL.md` phase mini-cycle and overview checklist already include commit after save, but with the old `/git-commit` name.
- `skills/b-build/SKILL.md`, `skills/b-review/SKILL.md`, and `skills/b-iterate/SKILL.md` still recommend `/b-save` as the session finalizer in several closeout paths.

### Documentation surfaces to update

In-repo:

- `README.md`
- `docs/buck-workflow.md`
- `docs/extension-loading.md` command inventory example
- `AGENTS.md`
- `GLOBAL_OR_PROJECT-AGENTS.md`
- `prompts/b-commit.md` and `commands/b-commit.md`
- remove or de-emphasize `prompts/git-commit.md` and `commands/git-commit.md` as Buck workflow entrypoints while keeping `skills/git-commit/SKILL.md` as the implementation
- `skills/b-plan/SKILL.md`
- `skills/b-phase/SKILL.md`
- `skills/b-build/SKILL.md`
- `skills/b-review/SKILL.md`
- `skills/b-iterate/SKILL.md`
- `skills/b-save/SKILL.md`

Global / chezmoi-managed:

- Source file: `/home/buckleyrobinson/.local/share/chezmoi/dot_pi/agent/AGENTS.md`
- Deployed file observed in this session: `/home/buckleyrobinson/.omp/agent/AGENTS.md`
- Rule: edit the chezmoi source, not the deployed file; preview/apply with chezmoi if deployment is part of the build.

### Important implementation decision

`b-commit` should be a workflow-facing command wrapper, not a second implementation. The reusable implementation remains `skills/git-commit/SKILL.md`. The new wrapper body should be equivalent to:

````markdown
# B Commit

Load and follow the `git-commit` skill:

```
skills/git-commit/SKILL.md
```
````

The workflow should use `/b-commit`; the skill name remains `git-commit` because it is the generic helper that can be invoked outside Buck workflow semantics.
