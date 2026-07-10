---
status: pending
phase: 4
order: 4
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; live runtime API migration and executable-kernel acceptance
buck_hint: /b-build-hard
goal: "Generate and document workflow eval cells that execute on the maintained OMP runtime."
files:
  - skills/b-plan/SKILL.md
  - docs/eval-kernel.md
  - prompts/omp-workflow.md
  - commands/omp-workflow.md
  - examples/eval-kernel/eval-review-audit.py
  - examples/eval-kernel/eval-migration-sweep.py
from_plan_steps: [4]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Generated workflow cells use completion(), the current agent signature, and injected helpers"
  - "[ ] Runtime-facing cells contain no stale llm(), agent_type=, or prelude import contract"
  - "[ ] package.json omp metadata is not used as active-runtime evidence"
  - "[ ] One generated starter and one canonical example execute in the real maintained OMP eval kernel"
  - "[ ] Canonical examples live outside historical .context execution artifacts"
completed_at: null
completed_by: null
---

# Phase 4: OMP Eval-kernel Compatibility

## Context

**Inherited parent goal**: Buck Workflow users can run generated OMP execution cells instead of receiving code for an obsolete kernel API.

The audit observed OMP 16.3.15 exposing `completion()` and `agent(..., agent="task")`, with helpers injected into the live kernel; `llm`, `agent_type`, and `from prelude import` are stale. Phase 3 lands the shared `b-plan` staging instructions first; this phase then fixes executable generation before Phase 5 centralizes recommendations around it.

## Implementation Details

1. Re-read the maintained OMP eval contract at implementation time and record the tested version/date in `docs/eval-kernel.md`.
2. Rewrite `b-plan`'s generated workflow cell to use injected helpers, `completion()`, current `agent()` options, current schema handling, and persistent-kernel semantics. Remove `from prelude import` and `agent_type=`.
3. Remove `package.json.omp` from runtime detection. Package metadata describes install surfaces, not the active harness.
4. Update `prompts/omp-workflow.md` only as an observation/instruction surface; it must not claim to activate workflow mode.
5. Move maintained example cells to `examples/eval-kernel/`; repoint `b-plan` and docs there. Leave old `.context/**` examples as historical evidence.
6. Preserve a safe plain-Python guard/no-op for syntax checking outside OMP without faking a successful workflow run.
7. Execute one newly generated cell and one canonical example directly in the real eval kernel. Exercise both `agent()` fan-out and `completion()` synthesis.
8. Add a focused static/runtime fixture that catches stale helper names in runtime-facing templates without treating historical artifacts as failures.

## Risks

- **Version-specific examples**: document maintained semantics and keep a live smoke, not a frozen helper list with no test.
- **False fallback success**: non-OMP guard must clearly report no-op; it cannot pretend agents ran.
- **Historical mutation**: old subject artifacts remain untouched; only active references move.
- **Kernel budget/failure semantics**: examples must show real error propagation and structured result handling, not only happy-path syntax.

## Verification

- Generate `eval-<topic>.py` from the updated template; run it in the real OMP eval tool and observe successful helper resolution.
- Run `examples/eval-kernel/eval-review-audit.py` in the same kernel; confirm `agent()` results reach `completion()` synthesis.
- Plain Python syntax check succeeds and the guard reports a clear non-OMP no-op.
- Scoped search of runtime-facing templates/examples finds no `llm(`, `agent_type=`, or `from prelude import`; historical `.context` results are excluded intentionally.
- Pi/non-OMP plan generation does not emit OMP-only artifacts based solely on package metadata.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only.
2. Run the real-kernel acceptance before review; a text-only update is insufficient.
3. Run `/b-review` against this exact phase file.
4. Iterate in-plan failures and re-run both real-kernel smokes.
5. Run `/b-docs` if documentation impact is flagged.
6. Run `/b-save`, stage all implementation and durable artifacts, then `/b-commit`.
7. Leave `status: in-progress` if either real-kernel path is not proven.
