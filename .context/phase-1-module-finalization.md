---
status: completed
phase: 1
order: 1
plan: plan-state-machine-module-cutover.md
phases_overview: plan-state-machine-module-cutover-phases.md
difficulty: medium
model_hint: capable general model; bounded module work but requires careful behavior-test design
buck_hint: /b-build
goal: "Finalize extensions/state_machine/ as a side-effect-free, zero-import module with its own behavior tests, runnable example, and README."
files: [extensions/state_machine/index.ts, extensions/state_machine/state_machine.test.ts, extensions/state_machine/README.md, extensions/state_machine/examples/transmission.ts]
from_plan_steps: [1, 2, 3, 4]
depends_on: []
dependency_type: NONE
sql_memory_ids:
  - "01a0f787-76f9-7066-b52d-b5881d723178"
acceptance_criteria:
  - "[x] Importing extensions/state_machine/index.ts has no side effects; example code removed from the module"
  - "[x] rg shows no runtime import specifier leaving extensions/state_machine/ and no process./node:/Bun. use inside it; the Vitest test-only import is excluded"
  - "[x] state_machine.test.ts covers every behavior in plan step 3 (unreachable/stuck/no-final/duplicate-edge/undeclared-target rejection, restore unknown, non-target and guard-rejected transitions leaving state unchanged, throwing guard/effect, effect description returned, available filtering + manual exclusion, guarded manual edge enforced, final-with-targets moves, facts-less transition(to))"
  - "[x] bun extensions/state_machine/examples/transmission.ts runs and prints the documented output"
  - "[x] README.md documents vocabulary, definition vs instance, 1/many/0 caller policies, effects-as-data, manual edges, restore, error classes, DEFERRED includeManual"
  - "[x] Phase 1 TypeScript acceptance exception approved 2026-10-01: project diagnostics match master after checkout-root normalization; strict focused library/tests/example compilation passes; npx vitest run extensions/state_machine green (24 tests)"
completed_at: 2026-10-01
completed_by: b-save
---

# Phase 1: Module Finalization

## Context

Parent User Goal: a developer can read a machine's states, edges, guards, effects, and operator-only moves in one place and add a new state without learning three rule kinds; buck-loop runs on it unchanged; the module lifts into another project as-is.

This phase makes the prototype in `extensions/state_machine/index.ts` a real library: no side effects at import, no imports leaving the folder, its own tests, README, and a runnable example. No consumer changes yet.

## Implementation Details

1. Make `index.ts` library-only: keep `defineMachine`, `MachineDefinition`, `MachineInstance`, `Transition`, `Guard`, `EffectOf`, `IllegalTransitionError`, `UnknownStateError`, `InvalidMachineError`; remove all example code. Keep the vocabulary header and the DEFERRED note on `available()`.
2. Move transmission + cut-down loop examples to `examples/transmission.ts`, importing only `../index.js`; runnable with `bun extensions/state_machine/examples/transmission.ts`.
3. Add `state_machine.test.ts` (vitest, imports only `./index.js`) covering: definition rejects unreachable / stuck / no-final / duplicate edge / undeclared target; `restore` rejects unknown names; `transition` rejects non-target (`not-a-target`) and failed guard (`guard-rejected`) leaving state unchanged; a throwing guard or effect leaves state unchanged; effect description is returned; `available` filters by guard and always excludes `manual`; a `manual` edge with a guard is enforced by `transition`; a final state with targets can still move; a facts-less machine calls `transition(to)`.
4. Write `README.md` (canonical module doc): vocabulary, definition vs instance, caller policies for 1 / many / 0 available, effects-as-data, `manual` edges, restore from persisted name, error classes, DEFERRED `includeManual`.

## Risks

- Test-design ambiguity on error classes vs messages — pin on error class identity, not message text.
- Examples accidentally re-introduce side effects into `index.ts` — verify import-time purity by importing in a test.

## Verification

- `npx vitest run extensions/state_machine`
- `bun extensions/state_machine/examples/transmission.ts`
- Self-containment: `rg -n "from ['\"]" extensions/state_machine` shows only in-folder specifiers; `rg -n "process\.|node:|Bun\." extensions/state_machine` empty.
- `npx tsc --noEmit -p .`

## Per-Phase Execution Loop

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues → separate `/b-plan` → `/b-build` follow-up. Doc impact → `/b-docs` before `/b-save`.
4. Run `/b-save`, then `/b-commit`.
5. If incomplete, leave `status: in-progress`.

## Build evidence (2026-10-01)

See [build-phase-1.md](build-phase-1.md). The module has 20 passing behavior tests, a clean strict type-check of library/tests/example, and verified example output. Runtime self-containment explicitly excludes the required Vitest development dependency; neither the library nor example imports outside the module folder.

The original combined criterion required `npx tsc --noEmit -p .` to be clean and the focused module tests to pass. The project check produces 194 pre-existing diagnostics, with no module diagnostics.

## Approved acceptance exception (2026-10-01)

After independent verification in a detached local master worktree at `e3ffb37abd1734ea2ceffac3fa0ea0e204dc1540`, master and this checkout both report 194 TypeScript diagnostics across 30 files; the complete output matches after checkout-root normalization. Strict focused compilation and all 24 module tests pass; required guardrails pass. See [iterate-module-finalization.md](iterate-module-finalization.md) for commands and comparison evidence.

The user explicitly approved the Phase 1-only TypeScript acceptance exception: "ok. I approve." This dispositions the clean-project requirement for this phase using the verified unchanged master baseline and passing focused check. The project errors remain unresolved; this exception does not change later-phase criteria or the guardrails contract.

## Closeout (2026-10-01)

Post-iteration [review](review-phase-1-module-finalization.md) completed with `pass-with-warnings`, no open in-plan defects, and passing required guardrails. Durable SQL save is recorded in [phase-1-save-rows.json](sql-memory-receipts/phase-1-save-rows.json), with `probed: true` and row `01a0f787-76f9-7066-b52d-b5881d723178`. The iteration is completed. Phase status is synchronized to `completed`; the overall four-phase subject remains active. The phase commit checkpoint is still pending in this checkout (HEAD `8e013d9`; module changes remain staged/unstaged).
