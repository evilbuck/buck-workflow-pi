---
status: active
date: 2026-06-11
subject: 2026-06-11.b-commit-final-step
topics: [b-commit, buck-workflow, ralph, omp, docs, chezmoi]
research: [research-current-commit-surface.md]
iterations: []
spec: null
memory: [b-commit-final-step-plan-2026-06-11.md]
---

# Plan: Make `b-commit` the final Buck workflow step

## User Goal

Agents and humans using Buck workflow have one consistent completion contract: every Buck loop unit ends with a durable context save and its own commit, using `/b-commit` as the workflow-facing final step.

## Goal

Make `/b-commit` the final Buck workflow step across skills, phase/goal/body loop instructions, README/docs, and global agent guidance. `/b-commit` should not duplicate commit logic; it should invoke the existing `git-commit` skill.

## Context used / assumptions

- User-provided context: final step should be `b-commit`; it runs the `git-commit` skill; goal/phase/body loop buffers include commits; each phase and each body gets its own commit; update documentation, READMEs, and chezmoi-managed global agents.
- Research artifact: `research-current-commit-surface.md`.
- Existing implementation: `skills/git-commit/SKILL.md` is already the commit engine and reads `draft-commit.md`.
- Existing OMP decision: prompt/skill-level integration only; no new orchestration extension.
- Assumption: "body" means any non-phased Ralph/workflow body unit that is treated as one executable loop buffer. The implementation should define this term in docs so future agents do not guess.

## Scope

- Add a Buck-facing `/b-commit` slash command wrapper that loads `skills/git-commit/SKILL.md`.
- Make the workflow completion sequence explicit everywhere: `build → review → iterate if needed → save → commit`.
- Replace Buck workflow references to `/git-commit` with `/b-commit`.
- Treat `/b-save` as the context checkpoint before commit, not the final workflow step.
- Update phase, goal, and body loop instructions so each unit requires its own commit before moving on or calling `ralph_done`.
- Align in-repo docs and the chezmoi-managed global AGENTS source.
- Preserve `skills/git-commit/SKILL.md` as the only commit implementation.

## Out of scope

- Reintroducing extension/state-machine orchestration.
- Auto-staging files before commit.
- Changing the commit message format beyond the existing Conventional Commits behavior.
- Implementing multi-commit splitting inside `git-commit`; the workflow must call `/b-commit` once per completed unit instead.
- Changing protected branch policy except where docs need to mention the existing `force` override.

## Affected files

### Command surface

- `prompts/b-commit.md` — new Buck-facing wrapper loading `skills/git-commit/SKILL.md`.
- `commands/b-commit.md` — new OMP symlink to `../prompts/b-commit.md`.
- `prompts/git-commit.md` / `commands/git-commit.md` — remove from the Buck workflow slash-command surface, or at minimum remove from workflow docs. Preferred clean cutover: remove the wrapper files and keep only the skill.

### Skills

- `skills/b-plan/SKILL.md` — Ralph instructions and output template should say `/b-save` then `/b-commit`; plan wording should call commit the final step.
- `skills/b-phase/SKILL.md` — phase template, overview template, checklist, integration notes, and resume behavior should say `/b-commit`; require one commit per phase.
- `skills/b-build/SKILL.md` — closeout and Ralph loop awareness should point to `/b-review` → `/b-save` → `/b-commit`, not stop at save.
- `skills/b-review/SKILL.md` — accepted-work closeout should recommend `/b-save` then `/b-commit`; review failure path should still block commit until iteration passes.
- `skills/b-iterate/SKILL.md` — closeout should point to `/b-review` → `/b-save` → `/b-commit`.
- `skills/b-save/SKILL.md` — clarify it prepares durable context and draft commit material for `/b-commit`; it is not the final step.
- `skills/git-commit/SKILL.md` — update examples to mention `/b-commit force` as the Buck wrapper if arguments are documented; keep the implementation name and behavior.

### Docs and READMEs

- `README.md` — command table, pure prompt table, workflow diagrams/examples, partial workflows, and compatibility notes.
- `docs/buck-workflow.md` — runtime mapping, OMP autonomous loop examples, mermaid diagrams, implementation matrix, b-save section, and add a new `b-commit` finalization section.
- `docs/extension-loading.md` — command inventory examples and prompt/command mirror examples.
- `AGENTS.md` — project-level architecture note should include `b-commit` as the final Buck step and preserve the git-commit implementation distinction.
- `GLOBAL_OR_PROJECT-AGENTS.md` — reusable bootstrap should include the final save → commit quality gate.

### Chezmoi-managed global agents

- `/home/buckleyrobinson/.local/share/chezmoi/dot_pi/agent/AGENTS.md` — update the Buck Workflow steps, recommended flows, and quality gate to include `b-commit` after save.
- Do not edit `/home/buckleyrobinson/.omp/agent/AGENTS.md` directly; it is deployed output.

## Implementation steps

1. Create `prompts/b-commit.md` as a thin wrapper that loads `skills/git-commit/SKILL.md`.
2. Create `commands/b-commit.md` as a symlink to `../prompts/b-commit.md` for OMP discovery.
3. Cleanly cut the workflow slash-command surface over to `/b-commit`:
   - Preferred: remove `prompts/git-commit.md` and `commands/git-commit.md` so `/b-commit` is the only Buck commit command.
   - Keep `skills/git-commit/SKILL.md` as the reusable implementation.
4. Update `skills/b-plan/SKILL.md`:
   - Non-phased Ralph cycle: `/b-build` → `/b-review` → `/b-iterate` if needed → `/b-save` → `/b-commit` → `ralph_done`.
   - Phased OMP wording: `/b-save` then `/b-commit` before `ralph_done` or next phase.
   - Output/recommended next-step text should call `/b-commit` the final step.
5. Update `skills/b-phase/SKILL.md`:
   - Phase mini-cycle instructions use `/b-commit`.
   - Phase overview checklist says each phase ends with save → commit.
   - Add explicit invariant: one phase completion equals one commit; do not batch multiple completed phases into one commit.
6. Update `skills/b-build/SKILL.md`, `skills/b-review/SKILL.md`, and `skills/b-iterate/SKILL.md` closeouts:
   - `b-build` writes/updates `draft-commit.md`, then recommends review → save → commit.
   - `b-review` only recommends commit after acceptance; failed review still routes to iterate.
   - `b-iterate` routes to review → save → commit and disallows `ralph_done` before commit in Ralph loops.
7. Update `skills/b-save/SKILL.md`:
   - Describe `/b-save` as the pre-commit durability checkpoint.
   - Ensure responsibilities still stop at `.context/` state and do not try to commit.
8. Update `skills/git-commit/SKILL.md` minimally:
   - Keep skill name `git-commit`.
   - Mention Buck invokes it through `/b-commit`.
   - If examples mention `/git-commit force`, change to `/b-commit force` for workflow use.
9. Update `README.md`:
   - Command table should list `/b-commit` → `git-commit`.
   - Full workflow and partial workflows end with `/b-save → /b-commit`.
   - Explain `/b-save` records context, `/b-commit` commits staged/drafted changes.
10. Update `docs/buck-workflow.md`:
    - Runtime mapping includes `/b-commit` prompt + OMP symlink.
    - OMP variations include save → commit in all completion paths.
    - Flow diagrams add a final commit node after save.
    - Add section: `/b-commit` — Final Commit, backed by `skills/git-commit/SKILL.md`.
    - Define phase/body commit invariant.
11. Update `docs/extension-loading.md` command inventory and examples to include `b-commit` and not advertise `git-commit` as the Buck slash command.
12. Update `AGENTS.md` and `GLOBAL_OR_PROJECT-AGENTS.md` so project-level and reusable bootstrap docs mention save → commit completion.
13. Update `/home/buckleyrobinson/.local/share/chezmoi/dot_pi/agent/AGENTS.md` with the same compact Buck Workflow change:
    - Steps include `b-commit` after `b-save`.
    - Recommended flows end in save → commit.
    - Quality gate includes commit created when completing a Buck loop unit.
14. If deploying the global agent update is in scope for the build pass, run `chezmoi diff` to preview and `chezmoi apply` after review; otherwise leave clear deployment instructions in the final build output.
15. Search all in-scope docs/skills for `/git-commit` and update or justify any remaining occurrences as implementation-only references.

## Verification

- Command mirror:
  - `prompts/b-commit.md` exists.
  - `commands/b-commit.md` resolves to `../prompts/b-commit.md`.
  - Prompt/command mirror remains consistent for Buck commands.
- Source search:
  - No Buck workflow instruction sequence ends at `/b-save` when it represents completed work.
  - No Buck workflow docs instruct users to run `/git-commit` as the final step.
  - Remaining `git-commit` references are only skill implementation references (`skills/git-commit/SKILL.md`, wrapper body, skill table if needed).
- Docs consistency:
  - `README.md`, `docs/buck-workflow.md`, `docs/extension-loading.md`, `AGENTS.md`, `GLOBAL_OR_PROJECT-AGENTS.md`, and chezmoi source AGENTS all agree on save → commit.
- Runtime/config sanity:
  - `package.json` remains valid JSON.
  - `commands/b-commit.md` works as an OMP-discovered symlink.
- Tests:
  - Run `npx vitest run` after source/doc updates because extension tests protect command registration boundaries and package assumptions.
- Chezmoi:
  - Run `chezmoi diff` from the chezmoi source or with source-path awareness before deployment.
  - If applied, confirm deployed `/home/buckleyrobinson/.omp/agent/AGENTS.md` contains `b-commit` in the Buck Workflow section.

## Ralph Instructions

This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to break it into sequential Ralph-ready phases with dependency analysis, per-phase model hints, and resume-safe execution instructions.

Recommended phase shape:

1. Command surface cutover — add `/b-commit`, mirror it, remove/de-emphasize `/git-commit` wrapper.
2. Skill loop semantics — update b-plan, b-phase, b-build, b-review, b-iterate, b-save, git-commit references.
3. Documentation alignment — README, docs/buck-workflow.md, docs/extension-loading.md, AGENTS.md, GLOBAL_OR_PROJECT-AGENTS.md.
4. Chezmoi global agent alignment — update source AGENTS, preview/apply if in scope.
5. Verification sweep — scoped searches, symlink checks, vitest, and chezmoi deployment check.

OMP recommendation: `orchestrate` if these phases are executed in one autonomous session, because the phases have hard dependencies and should not yield between semantic cutover and docs alignment. Otherwise, standard phased Ralph execution is enough.

## Risks

- Leaving both `/git-commit` and `/b-commit` as workflow-facing commands creates drift and violates the clean-cutover goal.
- Updating in-repo global docs but not the chezmoi source leaves the deployed global AGENTS stale.
- Committing before `/b-save` can lose memory/backlog/phase-state context from the commit.
- Batching multiple phases into one commit makes rollback and review harder; the docs must make one phase/body = one commit explicit.
- Removing `/git-commit` wrapper is a small breaking change for users who learned the old command; mitigate by making `/b-commit` discoverable in README/docs and preserving `skills/git-commit` as the implementation.
