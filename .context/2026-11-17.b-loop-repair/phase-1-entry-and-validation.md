---
status: completed
phase: 1
order: 1
plan: plan-b-loop-repair.md
phases_overview: plan-b-loop-repair-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Replace %load startup with explicit installed-path module import and enforce fail-closed subject, branch, adapter, and bridge validation before dispatching any stage."
omp_execution: none
files:
  - prompts/b-loop.md
  - skills/b-loop/SKILL.md
  - skills/b-loop/scripts/types.ts
  - skills/b-loop/scripts/frontmatter.ts
  - skills/b-loop/scripts/validation.ts
  - skills/b-loop/scripts/eval-buck-loop.ts
  - skills/b-loop/scripts/eval-buck-loop.test.ts
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] A-4 validated: packaged `/b-loop <subject>` resolves the installed `skills/b-loop/scripts/eval-buck-loop.ts` module from a separate fixture worktree that lacks Buck's source files and executes without module resolution or `%load` syntax errors."
  - "[x] `prompts/b-loop.md` and `skills/b-loop/SKILL.md` use explicit module `import(...)` of the resolved installed runner path and invoke `runBuckLoop` once with explicit `<subject>` and required OMP bridges (no `%load`, no optional flags)."
  - "[x] Runner fails closed before any stage dispatch when any required OMP bridge (`agent`, `wait`, `judge`, `sh`, `phase`, `log`, `tool.workflow_state`) is missing (mock/no-op bridge fallback removed)."
  - "[x] Invocation rejects missing/empty subject, removed flags (`--status`, `--resume`, `--stop`, profile flags), automatic subject selection, unphased plans, non-`repo-files` storage configs, `integration_ref` configurations, and detached or non-named Git branches before starting any work."
  - "[x] Target plan and discrete phase artifacts are resolved via `workflow_state` (with helper script paths resolved relative to `import.meta.url`, never relative to target `cwd`), pinning phase order and execution inputs before entering the phase loop."
  - "[x] Zero bare npm specifiers exist in `skills/b-loop/scripts/*.ts`."
completed_at: 2026-11-17
completed_by: Antigravity
---

# Phase 1: Entry, Invocation Contract & Pre-Flight Validation

## Context

Parent plan User Goal: When a phase fails or gets interrupted, Buck operators and their agents can see what finished and continue by running the same `/b-loop <subject>` command.

The audit at `1f02867` reproduced an OMP 18.22.0 startup failure from `%load skills/b-loop/scripts/eval-buck-loop.ts` (relative `cwd` assumption plus `eval` `%load` failure in worker runtime) and silent mock bridge fallbacks in `resolveBridges()`. This phase fixes the invocation entry point, establishes strict pre-flight validation of subject, Git branch, storage configuration, and OMP bridges, and pins discrete phase inputs via `workflow_state` before any stage side effect is enabled.

### Deferred Assumption Validation (A-4)
- **Assumption `A-4`**: "The packaged command can resolve the installed runner from a separate target worktree."
- **Validation owner**: Phase 1 is the earliest phase touching packaged command startup (`prompts/b-loop.md`, `skills/b-loop/SKILL.md`, runner entry) and must prove startup before enabling stage effects (Decision Closure & `plan-b-loop-repair.md`).
- **Validation path**: Exercise the packaged/installed `/b-loop <subject>` entry mechanism in installed OMP 18.22.0 (`omp`) from a separate temporary fixture Git worktree that contains NO Buck `skills/` source files, proving the prompt resolves and imports the installed runner module and fails cleanly / validates the target without needing relative repo paths.

## Implementation Details

1. **Resolve installed runner path (`A-4`)**:
   - Inspect how OMP exposes installed Buck skill/plugin paths when running from an arbitrary project checkout (`~/.omp/plugins`, `~/.omp/agent/config.yml`, plugin install directory, etc.) and design `prompts/b-loop.md` (with `commands/b-loop.md` symlink intact) and `skills/b-loop/SKILL.md` so the outer agent resolves the installed `eval-buck-loop.ts` path reliably without assuming Buck's repo is `cwd`.
   - Use explicit ES module import (`await import(resolvedRunnerUrl)`) inside OMP's Bun `eval` kernel (`language: "js"`, `timeout: 0`) and call the exported runner entry once with `(subjectArg, bridges)`.
   - Inside `skills/b-loop/scripts/`, resolve any auxiliary Buck script paths (e.g., `subject-lifecycle.ts` if invoked) relative to `import.meta.url`, never relative to `cwd`.
2. **Simplify argument & invocation contract**:
   - Require exactly one target `<subject>` identifier (reject empty/missing args, reject multiple targets, reject `--status`, `--resume`, `--stop`, and profile flags).
   - Remove automatic subject discovery/selection (`findSubjectFolders` / guessing latest subject).
3. **Fail-closed bridge validation**:
   - Require real OMP bridges (`agent`, `wait`, `judge`, `sh`, `phase`, `log`, `tool.workflow_state`); validate shape/callability up front and throw/return a clear validation error if any bridge is absent or unusable. Never synthesize silent mock/no-op bridges.
4. **Pre-flight Git, storage config, and plan validation**:
   - Verify target checkout is in a Git worktree on a valid named branch (reject detached `HEAD`, non-git directories, etc.).
   - Read effective Buck workflow storage configuration (checking `BUCK_WORKFLOW_CONFIG` / XDG config / default `repo-files`) and reject any adapter other than `repo-files` or any configured `integration_ref` / publication target before dispatching stages.
   - Resolve the named subject's plan and discrete phases via `tool.workflow_state`, verifying a discrete phased plan exists (reject unphased plans) and pinning deterministic phase order + phase execution inputs.
5. **Preserve zero bare npm specifiers**:
   - Keep `skills/b-loop/scripts/*.ts` free of bare npm imports (Node/Bun built-ins and relative `.ts` modules only).

## Risks

- **Package install layout variance**: Users may load Buck via OMP plugin install, `extensions:` path, or workspace checkout.
  - *Mitigation*: Test resolution order against installed plugin/skill locations and verify with a separate fixture worktree in installed `omp` (`A-4`).

## Verification

- `npx vitest run skills/b-loop/scripts/eval-buck-loop.test.ts` (testing argument rejection, missing bridge rejection, adapter/`integration_ref`/unphased/detached-HEAD rejection, `workflow_state` plan pinning, and zero bare imports).
- `npx vitest run scripts/commands-mirror.test.ts` (ensuring `commands/b-loop.md` symlink integrity).
- Live OMP 18.22.0 worker / headless command verification from an external temp worktree lacking Buck files (`A-4`).
- `npm run guardrails:check` and `npm run subject-lifecycle:check`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
