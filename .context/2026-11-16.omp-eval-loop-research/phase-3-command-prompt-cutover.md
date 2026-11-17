---
status: completed
phase: 3
order: 3
plan: plan-omp-eval-loop.md
phases_overview: plan-omp-eval-loop-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: "Expose /b-loop prompt and command wrappers running %load skills/b-loop/scripts/eval-buck-loop.ts and unwire wireBuckLoop(pi) in extensions/index.ts."
omp_execution: none
files:
  - skills/b-loop/SKILL.md
  - prompts/b-loop.md
  - commands/b-loop.md
  - extensions/index.ts
from_plan_steps: [4, 5]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] skills/b-loop/SKILL.md documents /b-loop arguments, OMP eval kernel execution requirement, and non-OMP harness fallback."
  - "[x] prompts/b-loop.md instructs the agent to set globalThis.BUCK_LOOP_ARGS from $ARGUMENTS and execute eval({ language: \"js\", code: \"%load skills/b-loop/scripts/eval-buck-loop.ts\", timeout: 0 })."
  - "[x] commands/b-loop.md is created as a symlink to ../prompts/b-loop.md."
  - "[x] npx vitest run scripts/commands-mirror.test.ts passes."
  - "[x] wireBuckLoop(pi) and its import are removed from extensions/index.ts, while extensions/buck-loop/ remains intact on disk."
  - "[x] Vitest test suites for extensions and prompts pass without errors."
completed_at: 2026-11-17
completed_by: Antigravity
---

# Phase 3: Command & Prompt Entrypoints and Extension Cutover

## Context

Parent plan User Goal: Run unattended Buck phase loops in OMP via a hot-reloadable TS/JS `eval` script (`workflowz` + `%load`) using native `agent()`/`judge()`, retiring the 17.7k-line `buck-loop` extension.

This phase exposes `/b-loop` as a discoverable prompt template and symlinked command wrapper that executes the TypeScript eval runner from Phase 2 via `%load`, and completes the extension cutover by unwiring `wireBuckLoop(pi)` from `extensions/index.ts`.

## Implementation Details

1. **`skills/b-loop/SKILL.md`**:
   - Document purpose, syntax (`/b-loop [target] [--status | --resume | --stop]`), and integration with OMP's `workflowz` keyword.
   - Clarify prerequisite: OMP `eval` kernel (`language: "js"`). Provide clear degradation message for non-OMP harnesses.

2. **`prompts/b-loop.md` and `commands/b-loop.md`**:
   - Author `prompts/b-loop.md` instructing the model to assign `globalThis.BUCK_LOOP_ARGS = "$ARGUMENTS"` and run `eval({ language: "js", code: "%load skills/b-loop/scripts/eval-buck-loop.ts", timeout: 0 })`.
   - Symlink `commands/b-loop.md` → `../prompts/b-loop.md`.
   - Ensure it conforms to the mirror contract validated by `scripts/commands-mirror.test.ts`.

3. **Unwire `wireBuckLoop(pi)`**:
   - In `extensions/index.ts`, remove `import { wireBuckLoop } from "./buck-loop/index.js";` and the `wireBuckLoop(pi);` invocation.
   - Retain `extensions/buck-loop/` on disk for pure module imports (`machine.ts`, `types.ts`, `phase-completion.ts`) and existing unit test verification.
   - Update any tests in `extensions/index.test.ts` that previously asserted `wireBuckLoop` was called.

## Risks

- **Symlink breakages or git index inconsistencies**:
  - *Mitigation*: Run `npx vitest run scripts/commands-mirror.test.ts` to ensure symlink resolution and content parity.

## Verification

- `npx vitest run scripts/commands-mirror.test.ts extensions/index.test.ts`
- `npm run guardrails:check` at coherent checkpoint

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
