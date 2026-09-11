---
status: completed
phase: 1
order: 1
plan: plan-b-save-state-machine.md
phases_overview: plan-b-save-state-machine-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Prove or refute the public-SDK guarded Hindsight retain boundary, and freeze the two-command contract, so every later engine module builds on settled boundaries."
omp_execution: goal
omp_goal_budget: 80000
files:
  - extensions/b-save/experiments/hindsight-guarded-retain.ts
  - .context/2026-09-10.b-save-state-machine-analysis/research/hindsight-guarded-retain-result.md
  - .context/2026-09-10.b-save-state-machine-analysis/spec-b-save-command-contract.md
  - package.json
from_plan_steps: [1, 2]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] Bounded executable experiment runs against the installed `@oh-my-pi/pi-coding-agent` revision and exercises only public API surfaces."
  - "[x] Evidence file records the exact API surface used and the observed result of the guarded pre-execution retain attempt."
  - "[x] Hindsight delivery decision is locked: guarded adapter mechanism documented, or the explicit `unsupported` outcome is locked for Phase 5 — no raw `retain` exposure, no OMP patching, no post-execution payload check treated as the integrity boundary."
  - "[x] Frozen contract spec defines `/b-save` (engine) and `/deprecated-b-save` (unchanged prompt-driven fallback), with `/b-save-improved` removal only after parity."
  - "[x] Contract spec enumerates engine flags (`--dry-run`, `--subject`, `--no-retain`, `--model`, explicit inferred-completion policy), a stable resume selector for non-terminal runs, and headless-ambiguity behavior that returns a run ID plus recovery instructions instead of guessing."
  - "[x] Any SDK dependency required by the experiment is recorded; final package normalization is explicitly deferred to the Phase 6 cutover."
completed_at: 2026-09-10
completed_by: omp-goal
---

# Phase 1: Boundaries & Contract Freeze

## Context

Parent plan user goal (inherited): Buck Workflow users run the new deterministic checkpoint as `/b-save`, while the current prompt-driven workflow remains available as `/deprecated-b-save` for compatibility and fallback.

This phase settles the two decisions every later module encodes: (a) whether OMP's shipped public SDK can enforce a trusted pre-execution guarded Hindsight retain, and (b) the exact frozen public command contract. It front-loads the highest-uncertainty work so the plan fails fast if the Hindsight boundary is unachievable. Covers plan steps 1–2.

## Implementation Details

1. **SDK experiment (plan step 1).** Build a bounded executable experiment at `extensions/b-save/experiments/hindsight-guarded-retain.ts` against the installed `@oh-my-pi/pi-coding-agent` API. Verify whether a restricted nested session can receive exactly one caller-owned capability whose opaque token is expanded to the prevalidated fact payload **before** native Hindsight retain executes. Use disposable projects/backends — never mutate real memory.
2. **Record evidence.** Write the observed API surface and result to `research/hindsight-guarded-retain-result.md` in this subject folder. If no public pre-execution gate exists, lock plan step 8 (Phase 5 effects) to the explicit `unsupported` outcome. Do not expose raw `retain`, patch OMP, or defer correctness to a post-execution check. The durable `.context` checkpoint must remain valid either way.
3. **Freeze the contract (plan step 2).** Write `spec-b-save-command-contract.md` defining:
   - Final public surfaces: `/b-save` (new engine), `/deprecated-b-save` (unchanged prompt-driven fallback), `/b-save-improved` removed only after parity passes.
   - Compatible engine flags: `--dry-run`, `--subject`, `--no-retain`, `--model`, and an explicit inferred-completion policy.
   - A stable resume selector for non-terminal runs (run-ID based).
   - Headless ambiguity contract: return a run ID and recovery instruction, never guess.
4. **Dependencies.** If the experiment needs an explicit SDK devDependency, record it in `package.json` now; final packaging normalization happens at the Phase 6 cutover.

## Risks

- **Guarded Hindsight delivery may be impossible through the public SDK.** Safe result is an explicit `unsupported` effect, not a weaker retain path. Phase 5 must be built to accept either outcome.
- **Experiment side effects.** Confine all memory writes to disposable backends; the experiment must not touch the real Hindsight store.
- **A vague contract here becomes rework in every later phase.** The spec must be concrete enough that Phases 2–6 can encode it without re-deciding.

## Verification

- Run the experiment against the actual installed OMP revision; confirm the evidence file records API calls and the observed result.
- Confirm the decision is binary and recorded: guarded adapter proven (mechanism documented) or `unsupported` locked.
- Review the contract spec against plan step 2's checklist item by item.
- `npm run context:validate` passes for the new artifacts; Marksman reports no new diagnostics.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.

**First-turn precondition (`omp_execution: goal`):** run `/goal set "Buck Workflow users run the new deterministic checkpoint as /b-save, while the current prompt-driven workflow remains available as /deprecated-b-save" --budget 80000`, then begin the build. The active goal persists across turns and phases (budget = 16k × 4 hard phases + 8k × 2 medium phases, plan-wide sum), and triggers the 6-step completion-audit on `goal({op:'complete'})`. Note: Phase 6's live-session parity checks are the one place the goal session may need to hand control to the user — do not mark the goal complete until the parity checklist passes.
