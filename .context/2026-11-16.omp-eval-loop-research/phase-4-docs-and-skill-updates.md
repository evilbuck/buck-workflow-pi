---
status: pending
phase: 4
order: 4
plan: plan-omp-eval-loop.md
phases_overview: plan-omp-eval-loop-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: "Update architecture documentation and b-plan/b-phase skills to reflect OMP 18.x workflowz, TypeScript eval, %load, and /b-loop."
omp_execution: none
files:
  - docs/eval-kernel.md
  - docs/buck-workflow.md
  - skills/b-plan/SKILL.md
  - skills/b-phase/SKILL.md
from_plan_steps: [6]
depends_on: [3]
dependency_type: SOFT
acceptance_criteria:
  - "[ ] docs/eval-kernel.md documents language: \"js\" Bun TypeScript transpilation, LocalModuleLoader bare npm specifier constraints, %load script execution, judgeBatch(), and before_subagent_spawn stage model routing."
  - "[ ] docs/buck-workflow.md updates the Runtime package mapping table to reflect extensions/buck-loop/ as unwired, documents /b-loop as the workflowz eval loop, and notes OMP 18.x keyword changes."
  - "[ ] skills/b-plan/SKILL.md adds a TypeScript eval cell option (eval-<topic>.ts, language: \"js\") alongside the Python template, and updates omp_execution references to include workflowz."
  - "[ ] skills/b-phase/SKILL.md updates Per-Phase Execution Loop table and omp_execution documentation to mention workflowz and %load."
  - "[ ] npm run guardrails:check and npm run subject-lifecycle:check pass cleanly."
completed_at: null
completed_by: null
---

# Phase 4: Documentation & Workflow Skill Updates for OMP 18.x

## Context

Parent plan User Goal: Run unattended Buck phase loops in OMP via a hot-reloadable TS/JS `eval` script (`workflowz` + `%load`) using native `agent()`/`judge()`, retiring the 17.7k-line `buck-loop` extension.

This phase synchronizes repository documentation, architecture guides, and planning skills (`b-plan`, `b-phase`) with the OMP 18.x TypeScript `eval` runtime (`workflowz`, `%load`, `agent()`, `judge()`, `judgeBatch()`, `before_subagent_spawn`) and the newly shipped `/b-loop` prompt/command.

## Implementation Details

1. **`docs/eval-kernel.md`**:
   - Add reference for OMP `eval` `language: "js"` (Bun/TypeScript) execution.
   - Document `LocalModuleLoader` constraints: bare npm specifiers fail in compiled OMP binaries; repo-local relative `.ts` modules are supported.
   - Document `%load <path>`, `judgeBatch()`, and `before_subagent_spawn` subagent model routing.

2. **`docs/buck-workflow.md`**:
   - Update `Runtime package mapping` table: note `extensions/buck-loop/` is unwired and scheduled for deletion, while `/b-loop` (`skills/b-loop/scripts/eval-buck-loop.ts`) is the active OMP autonomous runner.
   - Update `OMP Autonomous Loops` section to explain `workflowz` keyword pairing, `/b-loop`, and the hot-reloadable `%load` workflow.

3. **`skills/b-plan/SKILL.md`**:
   - Update `omp_execution: workflow` documentation to reflect OMP 18.x `workflow` / `workflowz` keywords.
   - Add a TypeScript `eval-<topic>.ts` workflow template cell alongside the Python template.

4. **`skills/b-phase/SKILL.md`**:
   - Update `Per-Phase Execution Loop` instructions to reference `workflowz` and `%load`.

## Risks

- **Doc drift across skills**:
  - *Mitigation*: Run `npm run guardrails:check` to ensure no broken doc links or conventions violations.

## Verification

- `npm run guardrails:check`
- `npm run subject-lifecycle:check`

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
