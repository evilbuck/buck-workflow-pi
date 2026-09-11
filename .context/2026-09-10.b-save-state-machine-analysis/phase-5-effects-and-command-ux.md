---
status: pending
phase: 5
order: 5
plan: plan-b-save-state-machine.md
phases_overview: plan-b-save-state-machine-phases.md
difficulty: medium
model_hint: capable general model preferred
buck_hint: /b-build
goal: "Ship post-apply external effects and the resumable /b-save command UX with honest terminal reporting."
files:
  - extensions/b-save/effects.ts
  - extensions/b-save/index.ts
  - extensions/b-save/__tests__
from_plan_steps: [8, 9]
depends_on: [1, 4]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Local and Mnemopi delivery call `ctx.memory.status()/save()` directly with backend and result-count validation."
  - "[ ] The Hindsight adapter uses the guarded pre-execution capability only if Phase 1 proved it; otherwise the effect records `unsupported`. Raw model-controlled `retain` is structurally impossible."
  - "[ ] Each effect retries at most once and records `succeeded | failed_nonblocking | unsupported | skipped`; no effect failure invalidates the durable `.context` checkpoint."
  - "[ ] Non-OMP re-indexing lives in an isolated best-effort adapter; the release does not claim engine portability."
  - "[ ] The command adapter persists run state after every meaningful transition, presents policy choices through OMP UI, and returns actionable headless instructions (run ID + recovery steps)."
  - "[ ] Terminal reporting distinguishes selected subject, run ID, resumed/invalidated states, durable files, staged user decisions, warnings, and effect outcomes — never collapsing failed model, failed apply, unsupported effect, or completed durable save into one success message."
  - "[ ] Effect and command-wiring Vitest suites pass; `extensions/index.ts` registration remains deferred to the Phase 6 cutover (adapter tested via direct invocation)."
completed_at: null
completed_by: null
---

# Phase 5: External Effects & Command UX

## Context

Parent plan user goal (inherited): Buck Workflow users run the new deterministic checkpoint as `/b-save`, while the current prompt-driven workflow remains available as `/deprecated-b-save` for compatibility and fallback.

Completes the engine: effects run only after Phase 4's durable apply succeeds, and the command adapter makes the machine drivable and observable. The Hindsight decision from Phase 1's proof is binding here. Covers plan steps 8–9.

## Implementation Details

1. **External effects (plan step 8) — `extensions/b-save/effects.ts`.**
   - `ctx.memory.status()/save()` direct delivery for local and Mnemopi backends; validate backend identity and returned counts (the 2026-09-10 SDK finding: Hindsight lacks `MemoryBackend.save` and returns `stored: 0` — never misread that as success).
   - Guarded Hindsight adapter **only** if Phase 1 proved the pre-execution capability; otherwise record `unsupported`. Retry once; outcomes `succeeded | failed_nonblocking | unsupported | skipped`.
   - Non-OMP re-index: isolated best-effort adapter for future harness support only — no portability claims in this release.
2. **Command UX (plan step 9) — `extensions/b-save/index.ts`.**
   - Drive the machine from the command adapter; persist after every meaningful transition.
   - Present policy choices (multi-subject selection, inferred backlog changes) through OMP UI; headless ambiguity returns a run ID plus recovery instruction.
   - Honest terminal reporting per the frozen Phase 1 contract; resume via the stable run-ID selector.
   - Do **not** register `/b-save` in `extensions/index.ts` yet — the command-name cutover is atomic in Phase 6. Test the adapter by direct invocation.

## Risks

- **Effect failure masquerading as save failure.** Effects are post-durable and non-blocking; the report must make the distinction visible.
- **Registering the command early** would shadow the current prompt-driven `/b-save` before parity — defer all registration to Phase 6.
- **Hindsight result ambiguity** (`stored: 0`): validate counts, don't trust HTTP 200 alone.

## Verification

- Run effect suites against fake/local backends: outcome recording, retry-once, `unsupported` path, non-blocking failure.
- Run command-wiring tests: transition persistence, UI gate invocation, headless run-ID output, terminal-report differentiation.
- Confirm `extensions/index.ts` is unchanged and `b-save-improved` still loads.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only (escalate to `/b-build-hard` if UX/reporting ambiguity appears).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.

*(Goal mode: if not already active, this phase runs under the goal set in Phase 1's first turn.)*
