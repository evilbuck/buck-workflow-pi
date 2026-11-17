---
status: active
date: 2026-11-17
subject: 2026-11-16.omp-eval-loop-research
topics: [omp, eval, workflowz, buck-loop, typescript, buck-models, before-subagent-spawn]
research: [research-omp-eval-loop.md]
iterations: []
spec:
memory: []
---

# Plan: Replace `/buck-loop` Extension with OMP TypeScript `eval` Runner (`workflowz`)

## User Goal
Run unattended Buck phase loops in OMP via a hot-reloadable TS/JS `eval` script (`workflowz` + `%load`) using native `agent()`/`judge()`, retiring the 17.7k-line `buck-loop` extension.

## Goal
Replace the wired `extensions/buck-loop/` runtime supervisor with:
1. A `%load`-able TypeScript `eval` loop script (`skills/b-loop/scripts/eval-buck-loop.ts`, executed under `eval` `language: "js"`) and a discoverable `/b-loop` prompt/command wrapper (`prompts/b-loop.md` + `commands/b-loop.md`).
2. Automatic `/buck-models` per-stage subagent model routing for `eval` `agent()` spawns via OMP's `before_subagent_spawn` extension hook in `extensions/interactive-model-switch.ts`.
3. Unwiring `wireBuckLoop(pi)` from `extensions/index.ts` (preserving `extensions/buck-loop/` on disk for a later deletion pass).
4. Updating `docs/buck-workflow.md`, `docs/eval-kernel.md`, `skills/b-plan/SKILL.md`, and `skills/b-phase/SKILL.md` to reflect OMP 18.x `workflowz`, TypeScript `eval` (`language: "js"`), `agent()`, `workpool()`, `wait()`, `judge()`, and `judgeBatch()`.

## Context used / assumptions
- **User-provided context**:
  - Confirmed User Goal: run unattended Buck phase loops in OMP via a hot-reloadable TS/JS `eval` script (`workflowz` + `%load`) using native `agent()`/`judge()`.
  - Cutover strategy: unwire `wireBuckLoop(pi)` in `extensions/index.ts` now; leave deleting `extensions/buck-loop/` for a separate follow-up.
  - Stage model routing: wire `before_subagent_spawn` in `extensions/` so `/buck-models` stage profiles route `eval` `agent()` calls automatically without requiring extra OMP `task.perCallModel` settings.
- **Session context & Artifacts used**:
  - [`research-omp-eval-loop.md`](research-omp-eval-loop.md) — source-verified analysis and live validation against OMP `v18.21.0` / `v18.22.0` (`@oh-my-pi/pi-coding-agent`).

## Light Grill
- Q1: Which User Goal should anchor the plan? → resolved: Confirm User Goal: Run unattended Buck phase loops in OMP via a hot-reloadable TS/JS eval script (`workflowz` + `%load`) using native `agent()`/`judge()`, retiring the 17.7k-line `buck-loop` extension (recommended)
- Q2: How should the retirement of `extensions/buck-loop/` be sequenced? → resolved: Unwire only: build the TS eval loop, unwire `wireBuckLoop(pi)` in `extensions/index.ts`, and delete the folder in a later follow-up
- Q3: How should per-stage model routing (`/buck-models` for `build`, `review`, `iterate`, `save`, `commit`) work in the TS eval runner? → resolved: Route via `before_subagent_spawn` in `buck-models` / `interactive-model-switch` (plus pass model from profile when `task.perCallModel` allows) so `/buck-models` stage profiles work out-of-the-box without extra OMP config (recommended)

## Decision Closure

- **Selected course**: Implement the Buck loop as a hot-reloadable TypeScript script (`skills/b-loop/scripts/eval-buck-loop.ts`) loaded into OMP's Bun `eval` kernel (`language: "js"`) via `/b-loop` (`prompts/b-loop.md` + `commands/b-loop.md`), route subagent stage models in `extensions/interactive-model-switch.ts` via `before_subagent_spawn`, and unwire `wireBuckLoop(pi)` in `extensions/index.ts` while retaining `extensions/buck-loop/` on disk for pure-module imports (`machine.ts`, `types.ts`, `phase-completion.ts`) and easy rollback.
- **Evidence**:
  - Live IPC validation against `/home/buckleyrobinson/.local/share/mise/installs/oh-my-pi/18.22.0/omp __omp_worker_js_eval_process` proved multi-cell TypeScript execution, direct import of `./extensions/buck-loop/machine.ts`, and wire execution of `agent()`, `wait()`, and `judge()`.
  - Source inspection of `src/task/structured-subagent.ts:649-677` and `src/extensibility/extensions/types.ts:1224` confirmed `before_subagent_spawn` fires for `invocationKind: "eval"` with `spawnKey` derived from `agent(..., { label })` and overrides `policy.modelOverride` without requiring `task.perCallModel`.
  - Live reproduction in `omp` `18.22.0` confirmed `LocalModuleLoader` fails on bare npm specifiers (`"yaml"`) inside the compiled binary's `/$bunfs/` FS, establishing the rule that `eval-buck-loop.ts` must only import pure relative `.ts` modules (`machine.ts`, `types.ts`, `phase-completion.ts`) and invoke `await tool.workflow_state(...)` or ``await sh`bun ...` `` for YAML/storage operations.
- **Excluded scope**:
  - Physical deletion of `extensions/buck-loop/**` (deferred to a follow-up cleanup after real-world `/b-loop` runs).
  - Non-OMP harness execution of the `eval` kernel (Pi and Claude Code do not ship OMP's `eval` worker; `/b-loop` documents its OMP `eval` requirement and degrades gracefully).
- **Next action**: Run `/skill:b-phase` (or `/b-build` if executing directly) starting with the `before_subagent_spawn` model routing hook and the TypeScript `eval-buck-loop.ts` runner.

## Assumptions Ledger

| `id` | `statement` | `status` | `blocking` | `evidence` | `validation_path` |
|---|---|---|---|---|---|
| `A-1` | OMP's `"js"` `eval` worker transpiles TypeScript and imports repo-local `.ts` files (`machine.ts`, `types.ts`, `phase-completion.ts`) that do not contain bare npm specifiers. | `validated` | `false` | Verified in live `omp __omp_worker_js_eval_process` test (`research-omp-eval-loop.md` §3.1–3.2). | Unit/integration test spawning `omp __omp_worker_js_eval_process` on `eval-buck-loop.ts`. |
| `A-2` | `pi.on("before_subagent_spawn", ...)` receives `invocationKind: "eval"` and `spawnKey` matching the sanitized `label` passed to `agent(prompt, { label })`, and returning `{ model }` sets the child subagent's model without requiring `task.perCallModel`. | `validated` | `false` | Verified in OMP `v18.21.0` `src/task/structured-subagent.ts:649-677` and `src/eval/agent-bridge.ts:217`. | Unit test in `extensions/index.test.ts` verifying `before_subagent_spawn` routing + refusal on invalid/missing stage profile. |
| `A-3` | Calling `await tool.workflow_state(...)` and ``await sh`bun ...` `` from inside `eval-buck-loop.ts` satisfies all artifact discovery, phase/plan scanning, lifecycle transitions, and git commit verification previously handled in `extensions/buck-loop/scan.ts` and `loop.ts`. | `deferred` | `false` | `src/eval/tool-bridge-policy.ts:4-5` exposes all active session tools except `checkpoint`/`rewind` to `tool.<name>`, and `__shell__` runs `sh` synchronously to completion. | Validate with an automated test harness simulating the `eval` host bridges (`__agent__`, `__wait__`, `__judge__`, `__judge_batch__`, `__shell__`, `workflow_state`) in `skills/b-loop/scripts/eval-buck-loop.test.ts`. |

## Material Risks

- **`failure_mode`**: `eval-buck-loop.ts` or one of its transitive local `.ts` imports introduces a bare npm specifier (e.g. `import { parse } from "yaml"`), causing `ResolveMessage: Cannot find package` inside the compiled `omp` binary's `LocalModuleLoader`.
  - **`impact`**: `%load skills/b-loop/scripts/eval-buck-loop.ts` fails at module link time before the loop starts.
  - **`mitigation`**: Restrict `eval-buck-loop.ts` imports to pure zero-npm-dependency modules (`extensions/buck-loop/machine.ts`, `extensions/buck-loop/types.ts`, `extensions/buck-loop/phase-completion.ts`, `extensions/state_machine/index.ts`) and enforce this with a smoke test running inside `omp __omp_worker_js_eval_process`.
  - **`rollback_or_fallback`**: Re-enable `wireBuckLoop(pi)` in `extensions/index.ts` (one-line restore) if a blocking regression occurs.
  - **`validation_path`**: Automated test in `skills/b-loop/scripts/eval-buck-loop.test.ts` that loads `eval-buck-loop.ts` through `omp __omp_worker_js_eval_process` (when `omp` is installed) and checks module linking with zero bare-specifier errors.

- **`failure_mode`**: Outer LLM modifies or paraphrases the runner script instead of executing `%load skills/b-loop/scripts/eval-buck-loop.ts` verbatim when `/b-loop` is invoked.
  - **`impact`**: Non-deterministic loop control flow or wasted outer-context tokens.
  - **`mitigation`**: `prompts/b-loop.md` instructs the agent to set `globalThis.BUCK_LOOP_ARGS` (if arguments were passed) and execute `eval({ language: "js", code: "%load skills/b-loop/scripts/eval-buck-loop.ts", timeout: 0 })` without reading or rewriting the script body.
  - **`rollback_or_fallback`**: User can paste `%load skills/b-loop/scripts/eval-buck-loop.ts` or re-wire `wireBuckLoop(pi)` in `extensions/index.ts`.
  - **`validation_path`**: Verify `prompts/b-loop.md` and `commands/b-loop.md` mirror contract via `npm run guardrails:check` and `scripts/commands-mirror.test.ts`.

## Scope
- **In scope**:
  1. **Subagent model routing (`extensions/interactive-model-switch.ts`)**:
     - Listen to `before_subagent_spawn` when `event.invocationKind === "eval"`.
     - Parse stage skill prefix from `event.spawnKey` (e.g., `b-build`, `b-build-hard`, `b-review`, `b-iterate`, `b-docs`, `b-save`, `b-commit`) using `INTERACTIVE_STAGE_BY_SKILL`.
     - Resolve the stage model through `selectInteractiveModel` and return `{ model: picked.id, note: "buckModels stage: <stage>" }`, or `{ block: true, reason: refusal(picked.message) }` when the active Buck profile fails validation.
  2. **TypeScript `eval` Buck loop runner (`skills/b-loop/scripts/eval-buck-loop.ts` & `skills/b-loop/SKILL.md`)**:
     - Author `skills/b-loop/scripts/eval-buck-loop.ts` for OMP's `"js"` (Bun/TypeScript) `eval` kernel:
       - Imports pure state machine transitions from `../../../extensions/buck-loop/machine.ts` (`buckMachine`, `start`, `next`, `applyChoice`).
       - Scans active subject, plan, phase, review, and iterate artifacts via `await tool.workflow_state(...)` and pure frontmatter/checkbox helpers (no bare `"yaml"` import).
       - Spawns isolated stage subagents via `await agent(prompt, { agent: "task", label: `${skill}-${phaseSlug}`, ... })` and waits via `await h.wait()`.
       - Uses native `await judge(...)` for closed-set continuation choice, acceptance criterion stamping (`type: "bool"`, threshold `>= 0.7`), and ambiguity lift classification (`light | medium | operator | heavy`).
       - Uses parallel `await judgeBatch(...)` to rank review issues on the 0–4 rubric (`impact`, `confidence`, `effort`).
       - Verifies git baseline HEAD and scoped staging (`files:` + `.context/`) via ``await sh`git ...` `` and `subject-lifecycle.ts` CLI before and after commit checkpoints.
       - Emits live TUI progress via `phase(...)` and `log(...)`, and checks `await budget.remaining()` between stages.
       - Persists `.context/workflow/buck-loop.json` projection for `--status` and `--resume`.
  3. **Command & Prompt Entrypoint (`prompts/b-loop.md` + `commands/b-loop.md`)**:
     - Create `prompts/b-loop.md` and symlink `commands/b-loop.md` → `../prompts/b-loop.md`.
     - Support `/b-loop [subject-or-phase] [--resume | --status | --stop]` by passing arguments via `globalThis.BUCK_LOOP_ARGS` and running `%load skills/b-loop/scripts/eval-buck-loop.ts` in `eval` (`language: "js"`, `timeout: 0`).
  4. **Unwire `wireBuckLoop` (`extensions/index.ts`)**:
     - Remove `wireBuckLoop(pi)` call and import from `extensions/index.ts` while keeping `extensions/buck-loop/` on disk.
  5. **Update OMP 18.x Docs & Templates (`docs/buck-workflow.md`, `docs/eval-kernel.md`, `skills/b-plan/SKILL.md`, `skills/b-phase/SKILL.md`)**:
     - Update magic keyword references from `workflow` to `workflowz` (`workflow` / `workflowz`) where applicable to OMP 18.x.
     - Document `language: "js"` TypeScript support, `%load`, `judgeBatch()`, `before_subagent_spawn` model routing, and the compiled-binary bare npm specifier rule in `docs/eval-kernel.md` and `docs/buck-workflow.md`.
     - Add a TypeScript (`eval-<topic>.ts`, `language: "js"`) workflow template option in `skills/b-plan/SKILL.md`.

## Out of scope
- Deleting `extensions/buck-loop/**` from the repository (deferred to a follow-up after real-world `/b-loop` validation).
- Modifying `extensions/code-review-iteration/` (remains wired on `extensions/state_machine/`).
- Changing `workflow_state` storage adapters or `subject-lifecycle.ts` authority rules.

## Affected files
- `extensions/interactive-model-switch.ts` — add `before_subagent_spawn` handler for `invocationKind: "eval"` stage model routing
- `extensions/index.test.ts` — add unit tests for `before_subagent_spawn` model routing and refusal blocking
- `extensions/index.ts` — unwire `wireBuckLoop(pi)`
- `skills/b-loop/SKILL.md` — new skill documenting the TypeScript `eval` loop runner, `workflowz` integration, and arguments
- `skills/b-loop/scripts/eval-buck-loop.ts` — new `%load`-able TypeScript loop runner for OMP `eval` (`language: "js"`)
- `skills/b-loop/scripts/eval-buck-loop.test.ts` — unit + `omp __omp_worker_js_eval_process` smoke tests for `eval-buck-loop.ts`
- `prompts/b-loop.md` — prompt wrapper invoking `eval` (`language: "js"`) with `%load skills/b-loop/scripts/eval-buck-loop.ts`
- `commands/b-loop.md` — symlink to `../prompts/b-loop.md`
- `skills/b-plan/SKILL.md` — update `workflow` / `workflowz` docs and add TypeScript `eval-<topic>.ts` template
- `skills/b-phase/SKILL.md` — update `omp_execution: workflow` Per-Phase Execution Loop wording to mention `workflowz` and `%load`
- `docs/eval-kernel.md` — document `"js"` TypeScript transpilation, `LocalModuleLoader` bare-specifier rule, `%load`, `judgeBatch()`, and `before_subagent_spawn`
- `docs/buck-workflow.md` — update runtime package mapping table and OMP Autonomous Loops section (`workflowz`, `/b-loop`, unwired `extensions/buck-loop/`)

## Implementation steps

1. **Extend `extensions/interactive-model-switch.ts` with `before_subagent_spawn` routing**:
   - Export a helper `stageSkillFromSpawnKey(spawnKey: string | undefined): { skill: string; stage: BuckStageKey } | null` that matches `spawnKey` prefixes (`b-build-hard`, `b-build`, `b-review`, `b-iterate`, `b-docs`, `b-howto`, `b-save`, `b-commit`, `b-research`, `b-explore`, `b-plan`, `b-phase`, `b-brainstorm`, `b-grill`, `b-present`) against `INTERACTIVE_STAGE_BY_SKILL`.
   - In `wireInteractiveModelSwitch`, register `pi.on("before_subagent_spawn", async (event, ctx) => ...)` that ignores events where `event.invocationKind !== "eval"` or `stageSkillFromSpawnKey(event.spawnKey)` is null, resolves the model via `selectInteractiveModel`, and returns `{ model: picked.id, note: `buckModels:${stage}` }` on success or `{ block: true, reason: refusal(picked.message) }` on failure.
   - Add unit tests in `extensions/index.test.ts` covering `eval` subagent model routing, non-Buck `spawnKey` pass-through, and invalid-profile blocking.

2. **Create `skills/b-loop/scripts/eval-buck-loop.ts` (TypeScript `eval` runner)**:
   - Implement zero-bare-npm-dependency frontmatter and acceptance-checkbox parser helpers so the script links cleanly inside `omp __omp_worker_js_eval_process`.
   - Import `buckMachine`, `start`, `next`, and `applyChoice` from `../../../extensions/buck-loop/machine.ts` and `evaluatePhaseCompletion` from `../../../extensions/buck-loop/phase-completion.ts`.
   - Implement `scanFacts()` using `await tool.workflow_state({ operation: "discover" | "list" | "read", ... })` and ``await sh`git status --porcelain` `` / ``await sh`git rev-parse HEAD` ``.
   - Implement `runStage(skill, phaseTarget, context)` using `await agent(prompt, { agent: "task", label: `${skill}-${phaseSlug}` })` + `await handle.wait()`.
   - Implement native judgment helpers using `await judge(state, questions)` for:
     - closed-set transition choice (`choice` question over `effect.options`),
     - acceptance criterion verification (`bool` questions with `>= 0.7` threshold),
     - ambiguity lift classification (`light | medium | operator | heavy`).
   - Implement review issue waterline ranking using `await judgeBatch(issueStates, ratingQuestions, { intent: "Rank review findings" })` + `await batch.drain()`.
   - Implement scoped git staging & commit baseline verification via `sh` (`git add` scoped to `.context/` and active phase `files:`) and subject closeout via ``await sh`bun skills/_shared/scripts/subject-lifecycle.ts close-verified --subject ${subjectDir} --json` ``.
   - Persist `.context/workflow/buck-loop.json` status snapshots on every transition and support `BUCK_LOOP_ARGS` (`--status`, `--resume`, `--stop`, or explicit target path).

3. **Write tests for `eval-buck-loop.ts` (`skills/b-loop/scripts/eval-buck-loop.test.ts`)**:
   - Unit-test the loop driver with mocked ` eval ` globals (`agent`, `wait`, `judge`, `judgeBatch`, `tool`, `sh`, `phase`, `log`, `budget`) across happy-path (`resolving → building → reviewing → saving → committing → done`), review iteration (`reviewing → ranking → iterating → reviewing`), and blocked recovery (`--status`, `--resume`).
   - Add an `omp __omp_worker_js_eval_process` smoke test (gated on `omp` binary presence) verifying that `%load` / importing `eval-buck-loop.ts` transpiles and links without any bare-specifier resolution errors.

4. **Create `/b-loop` skill, prompt template, and command mirror**:
   - Write `skills/b-loop/SKILL.md` documenting usage (`/b-loop`, `/b-loop <subject-or-phase>`, `/b-loop --status`, `/b-loop --resume`, `/b-loop --stop`, and `workflowz` keyword pairing).
   - Write `prompts/b-loop.md` instructing the OMP agent to execute `eval` with `language: "js"`, `timeout: 0`, setting `globalThis.BUCK_LOOP_ARGS` from `$ARGUMENTS` and running `%load skills/b-loop/scripts/eval-buck-loop.ts`.
   - Create symlink `commands/b-loop.md` → `../prompts/b-loop.md` and verify `scripts/commands-mirror.test.ts` passes.

5. **Unwire `wireBuckLoop(pi)` in `extensions/index.ts`**:
   - Remove `import { wireBuckLoop } from "./buck-loop/index.js";` and `wireBuckLoop(pi);` from `extensions/index.ts`.
   - Keep `extensions/buck-loop/**` on disk so its unit tests and pure modules (`machine.ts`, `types.ts`, `phase-completion.ts`) remain intact until the follow-up deletion task.

6. **Update documentation and `b-plan` / `b-phase` templates for OMP 18.x**:
   - Update `docs/eval-kernel.md` to cover `language: "js"` TypeScript transpilation, `LocalModuleLoader` (and the compiled-binary bare-specifier constraint), `%load`, `judgeBatch()`, and `before_subagent_spawn` stage model routing.
   - Update `docs/buck-workflow.md` (`Runtime package mapping` and `OMP Autonomous Loops`) to document `/b-loop` (`prompts/b-loop.md` + `skills/b-loop/`), note that `extensions/buck-loop/` is unwired, and update `workflow` keyword references to note OMP 18.x `workflowz`.
   - Update `skills/b-plan/SKILL.md` and `skills/b-phase/SKILL.md` so `workflow` / `workflowz` recommendations support TypeScript `eval` cells (`eval-<topic>.ts`, `language: "js"`) and `%load`.

## Acceptance criteria
- [ ] `extensions/interactive-model-switch.ts` handles `before_subagent_spawn` for `invocationKind: "eval"`, routing `b-*` subagent labels through the active `/buck-models` profile and blocking spawns when the profile is invalid or missing the stage.
- [ ] `skills/b-loop/scripts/eval-buck-loop.ts` imports `extensions/buck-loop/machine.ts` and links cleanly in `omp __omp_worker_js_eval_process` with zero bare npm specifier errors.
- [ ] `skills/b-loop/scripts/eval-buck-loop.ts` drives `resolving → building → reviewing → ranking → iterating → documenting → saving → committing → done` using `agent()`, `judge()`, `judgeBatch()`, `tool.workflow_state()`, `sh`, `phase()`, and `log()`.
- [ ] `prompts/b-loop.md`, `commands/b-loop.md` (symlink), and `skills/b-loop/SKILL.md` exist and pass `scripts/commands-mirror.test.ts`.
- [ ] `wireBuckLoop(pi)` is unwired from `extensions/index.ts`, while `extensions/buck-loop/` remains on disk.
- [ ] `docs/buck-workflow.md`, `docs/eval-kernel.md`, `skills/b-plan/SKILL.md`, and `skills/b-phase/SKILL.md` accurately document OMP 18.x `workflowz`, TypeScript `eval` (`language: "js"`), `%load`, `judgeBatch()`, and `/b-loop`.
- [ ] `npm run guardrails:check` and `npm run subject-lifecycle:check` pass.

## Verification
- `npx vitest run extensions/index.test.ts skills/b-loop/scripts/eval-buck-loop.test.ts scripts/commands-mirror.test.ts`
- `npm run subject-lifecycle:check`
- `npm run guardrails:check`

## Risks
- **Compiled `omp` binary bare npm specifier resolution**: Mitigated by avoiding bare npm imports in `eval-buck-loop.ts` and verifying module linking directly against `omp __omp_worker_js_eval_process` in `eval-buck-loop.test.ts`.
- **Existing tests referencing `wireBuckLoop` in `extensions/index.ts`**: Inspect and update any test that asserts `wireBuckLoop` is called by `extensions/index.ts` while keeping `extensions/buck-loop/__tests__/*` green.
