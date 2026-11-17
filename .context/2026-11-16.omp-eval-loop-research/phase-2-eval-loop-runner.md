---
status: completed
phase: 2
order: 2
plan: plan-omp-eval-loop.md
phases_overview: plan-omp-eval-loop-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Ship zero-bare-specifier TypeScript eval-buck-loop.ts runner for OMP Bun eval kernel with native agent, wait, judge, and judgeBatch transitions."
omp_execution: none
files:
  - skills/b-loop/scripts/eval-buck-loop.ts
  - skills/b-loop/scripts/eval-buck-loop.test.ts
from_plan_steps: [2, 3]
depends_on: [1]
dependency_type: SOFT
acceptance_criteria:
  - "[x] Validate deferred assumption A-3: automated test harness in eval-buck-loop.test.ts simulates eval host bridges (__agent__, __wait__, __judge__, __judge_batch__, __shell__, workflow_state) and proves artifact scanning, stage orchestration, lifecycle transitions, and commit verification without extensions/buck-loop/scan.ts."
  - "[x] skills/b-loop/scripts/eval-buck-loop.ts contains zero bare npm package specifiers, importing only relative .ts modules (machine.ts, types.ts, phase-completion.ts)."
  - "[x] Scans active subject, plan, phase, review, and iterate artifacts via await tool.workflow_state(...) and pure frontmatter helpers."
  - "[x] Spawns stage subagents via await agent(prompt, { agent: \"task\", label: `${skill}-${phaseSlug}` }) and awaits completion via await handle.wait()."
  - "[x] Implements native judgments: await judge(state, questions) for transition choice, acceptance criterion checking (bool with >= 0.7 threshold), and ambiguity lift; await judgeBatch() for review finding ranking."
  - "[x] Performs scoped git staging and commit baseline verification via sh and subject-lifecycle.ts."
  - "[x] Emits live TUI progress via phase() and log(), checks budget.remaining(), and persists .context/workflow/buck-loop.json status snapshots for --status and --resume."
  - "[x] Unit tests in eval-buck-loop.test.ts cover happy-path execution, review iteration, and blocked recovery."
  - "[x] Smoke test in eval-buck-loop.test.ts loads eval-buck-loop.ts through omp __omp_worker_js_eval_process (when omp binary is present) with zero module linking errors."
completed_at: 2026-11-17
completed_by: Antigravity
---

# Phase 2: TypeScript `eval` Buck Loop Runner & Bridge Tests

## Context

Parent plan User Goal: Run unattended Buck phase loops in OMP via a hot-reloadable TS/JS `eval` script (`workflowz` + `%load`) using native `agent()`/`judge()`, retiring the 17.7k-line `buck-loop` extension.

This phase builds the core `%load`-able TypeScript loop runner script (`skills/b-loop/scripts/eval-buck-loop.ts`) executing inside OMP's Bun `eval` kernel (`language: "js"`). It replaces the background node-worker architecture of `extensions/buck-loop/` with direct native eval host bridges (`agent`, `wait`, `judge`, `judgeBatch`, `sh`, `tool.workflow_state`, `phase`, `log`, `budget`).

### Deferred Assumption Validation (A-3)
- **Assumption `A-3`**: Calling `await tool.workflow_state(...)` and ``await sh`bun ...` `` from inside `eval-buck-loop.ts` satisfies all artifact discovery, phase/plan scanning, lifecycle transitions, and git commit verification previously handled in `extensions/buck-loop/scan.ts` and `loop.ts`.
- **Validation owner**: This phase is the earliest point where the `eval` execution environment and bridge calls are implemented and tested.
- **Validation path**: Author an automated test harness in `skills/b-loop/scripts/eval-buck-loop.test.ts` that mocks the `eval` global environment (`agent`, `wait`, `judge`, `judgeBatch`, `tool.workflow_state`, `sh`) and runs `eval-buck-loop.ts` through complete transitions, verifying that artifact resolution, stage orchestration, and lifecycle checks pass deterministically.

## Implementation Details

1. **Zero-npm-dependency helpers & imports**:
   - Import pure state machine logic: `buckMachine`, `start`, `next`, `applyChoice` from `../../../extensions/buck-loop/machine.ts` and `evaluatePhaseCompletion` from `../../../extensions/buck-loop/phase-completion.ts`.
   - Implement zero-dependency Markdown frontmatter parser and acceptance checkbox reader (avoiding bare `"yaml"` import which fails in OMP binary's `LocalModuleLoader`).

2. **Artifact scanning & state machine driving**:
   - Scan active subject, plan, and phase via `await tool.workflow_state({ operation: "discover" })` or `list`/`read`.
   - Track loop state and persist `.context/workflow/buck-loop.json` on every transition for `--status` inspection and `--resume`.

3. **Subagent dispatch & native judgment**:
   - Dispatch subagents via `await agent(stagePrompt, { agent: "task", label: `${skill}-${phaseSlug}` })` and `await handle.wait()`.
   - Evaluate closed-set transitions via `await judge(state, [{ id: "choice", type: "choice", options: ... }])`.
   - Evaluate acceptance criteria via `await judge(state, [{ id: criterionId, type: "bool", threshold: 0.7 }])`.
   - Evaluate review issue severity via `await judgeBatch(issues, ratingQuestions)`.

4. **Staging & commit checks**:
   - Scope git staging strictly to `.context/` and phase `files:`.
   - Verify clean working tree and commit state via ``await sh`git status --porcelain` `` and subject closeout via ``await sh`bun skills/_shared/scripts/subject-lifecycle.ts close-verified --subject ${subjectDir} --json` ``.

5. **Test suite (`skills/b-loop/scripts/eval-buck-loop.test.ts`)**:
   - Unit tests covering:
     - Full happy-path phase progression (`resolving → building → reviewing → saving → committing → done`).
     - Review findings triggering iteration loop (`reviewing → ranking → iterating → reviewing`).
     - Blocked recovery (`--status`, `--resume`, `--stop`).
   - Smoke test: when `omp` binary is detected on PATH, spawn `omp __omp_worker_js_eval_process` and execute `%load skills/b-loop/scripts/eval-buck-loop.ts` to confirm Bun TypeScript transpilation and zero bare-specifier resolution errors.

## Risks

- **Bare npm specifier leak**: A transitive import might reference `yaml` or another bare package, breaking the OMP binary.
  - *Mitigation*: The test suite includes a strict import scanner and live `omp __omp_worker_js_eval_process` execution check.

## Verification

- `npx vitest run skills/b-loop/scripts/eval-buck-loop.test.ts`
- `npm run guardrails:check` at coherent checkpoint

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
