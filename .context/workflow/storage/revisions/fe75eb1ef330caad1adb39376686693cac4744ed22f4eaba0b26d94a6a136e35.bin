---
status: completed
phase: 6
order: 6
plan: plan-buck-loop-extension.md
phases_overview: plan-buck-loop-extension-phases.md
difficulty: medium
model_hint: capable general model preferred — bounded command parsing and registration, with regression risk at the repository extension entrypoint
buck_hint: /b-build
goal: "Expose the completed supervisor as `/buck-loop` with explicit start, resume, status, and stop modes, then wire it into the extension surface."
files:
  - extensions/buck-loop/index.ts
  - extensions/index.ts
  - extensions/buck-loop/__tests__/wire.test.ts
from_plan_steps: [6]
depends_on: [5]
dependency_type: HARD
acceptance_criteria:
  - "[x] `wireBuckLoop(pi)` registers `/buck-loop` and `extensions/index.ts` invokes that wire exactly once."
  - "[x] The command accepts exactly `<path-to-plan|phase|subject>`, `--resume`, `--status`, or `--stop`, with rejected conflicting or unknown arguments."
  - "[x] Missing path without a resumable projection prints usage and performs no scan guess or nested work."
  - "[x] `--status` is read-only; `--stop` delegates to durable abort and is a no-op message when no run exists."
  - "[x] `extensions/b-flow/` remains unwired and no file under `extensions/buck-loop/` imports `xstate`."
  - "[x] Focused argument and wire tests pass."
completed_at: 2026-09-18
completed_by: omp
memory:
  - buck-loop-remaining-phases-2026-09-18.md
---

# Phase 6: Command Surface

## Context

Parent user goal: An operator can leave a well-scoped Buck plan running unattended through build → review → iterate-if-needed → docs-if-needed → save → commit → next phase, without XState. Every transition is either a deterministic disk/git check or a closed-set LLM choice the machine validates.

Phase 5 provides the complete supervisor. This phase makes invocation observable and intentional; it does not inject behavior into the main session or steal `/b-loop` from the advisory skill.

## Implementation Details

1. Create `extensions/buck-loop/index.ts` with `wireBuckLoop(pi)` and a small pure argument parser.
2. Register `buck-loop` through the existing `registerCommand` convention. Support only:
   - `/buck-loop <path-to-plan|phase|subject>`;
   - `/buck-loop --resume`;
   - `/buck-loop --status`;
   - `/buck-loop --stop`.
3. Reject unknown flags, conflicting modes, or extra positional arguments with concise usage. Missing path plus no resumable projection must stop without subject discovery.
4. Keep `--status` read-only. `--stop` should report a no-op when no projection/run exists; otherwise call the Phase 5 abort operation.
5. Edit `extensions/index.ts` to import and invoke `wireBuckLoop(pi)` alongside the current wires. Do not wire `extensions/b-flow/` and do not change existing command names.
6. Add tests using the repository's existing wire-test conventions. Cover registration, each mode, malformed args, missing path, status no projection, stop no run, and delegation to the supervisor.
7. Keep all orchestration in `loop.ts`; the command handler parses, delegates, and renders status only.

## Risks

- A permissive parser can silently choose resume or a subject. Mutually exclusive modes and explicit path requirements must be enforced.
- Registering both old and new supervisors would recreate hidden orchestration. Assert only `/buck-loop` is added.
- Running status through the supervisor loop could launch work. Use the read-only status operation.

## Verification

- Run `vitest run extensions/buck-loop/__tests__/wire.test.ts` and the complete `extensions/buck-loop/__tests__` directory.
- Inspect `extensions/index.ts` registration and assert the command is registered once.
- Confirm `xstate` and `extensions/b-flow/` are absent from imports under `extensions/buck-loop/`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the session resumes here next turn.
