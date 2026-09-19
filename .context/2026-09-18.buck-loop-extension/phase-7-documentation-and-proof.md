---
status: completed
phase: 7
order: 7
plan: plan-buck-loop-extension.md
phases_overview: plan-buck-loop-extension-phases.md
difficulty: medium
model_hint: capable general model preferred — reconcile a deliberate architecture-policy reversal with living docs and prove the complete command contract
buck_hint: /b-build
goal: "Document the observably invoked runner decision and verify the complete buck-loop behavior, command surface, and repository guardrails."
files:
  - docs/adr/0002-observably-invoked-happy-path-loop.md
  - docs/buck-workflow.md
  - docs/extension-loading.md
  - skills/b-loop/SKILL.md
from_plan_steps: [7]
depends_on: [6]
dependency_type: HARD
acceptance_criteria:
  - "[x] ADR 0002 records why an observably invoked hand-rolled runner is allowed, why XState is rejected here, and why `b-loop` remains advisory."
  - "[x] Living docs distinguish `/buck-loop` (runner) from `/skill:b-loop` (execution-mode stamper) and list the new wire accurately."
  - "[x] The blanket `no new orchestrator extension` statement and b-flow deprecation note are corrected without claiming hidden main-session orchestration."
  - "[x] All `extensions/buck-loop` tests pass; required repository guardrails pass; no `xstate` or `extensions/b-flow/` import exists under the new directory."
  - "[x] Smoke: `/buck-loop --status` with no projection reports idle, and `/buck-loop --stop` with no run reports a no-op."
  - "[x] Every acceptance criterion in the parent plan is checked against code or exercised behavior before completion."
completed_at: 2026-09-18
completed_by: omp
memory:
  - buck-loop-remaining-phases-2026-09-18.md
---

# Phase 7: Documentation and Proof

## Context

Parent user goal: An operator can leave a well-scoped Buck plan running unattended through build → review → iterate-if-needed → docs-if-needed → save → commit → next phase, without XState. Every transition is either a deterministic disk/git check or a closed-set LLM choice the machine validates.

The implementation deliberately reverses the 2026-06-01 blanket rule against a b-flow-style extension, but only for an explicit `/buck-loop` command with artifact-based postconditions. This phase makes that boundary durable and proves the finished surface.

## Implementation Details

1. Add `docs/adr/0002-observably-invoked-happy-path-loop.md`. Record:
   - context: deprecated/unwired XState b-flow is unreliable;
   - decision: explicit `/buck-loop`, pure table, hand-rolled loop, nested isolated sessions, artifact truth, closed-set model choices;
   - rejected alternatives: restoring XState, another FSM library, hidden main-session injection, expanding the advisory `b-loop` skill into a runner;
   - consequences: explicit invocation, projection reconciliation, bounded retries/counters, more local integration code.
2. Update `docs/buck-workflow.md`:
   - replace the blanket statement that forbids a new orchestrator extension;
   - keep the b-flow deprecation history accurate;
   - distinguish `/buck-loop` runner from `/skill:b-loop` stamper;
   - do not claim auto-planning, parallel phases, main-session injection, or automatic OMP loop activation.
3. Update `docs/extension-loading.md` wired-surface inventory with `wireBuckLoop` and `/buck-loop`.
4. Add one sentence to `skills/b-loop/SKILL.md`: this skill recommends/stamps execution modes; `/buck-loop` runs an existing plan.
5. Run the full `extensions/buck-loop/__tests__` suite, then `npm run guardrails:check`. Required failures block completion; advisory results are reported accurately.
6. Perform the actual command smoke in an OMP-capable session or the closest registered-command harness:
   - no projection + `--status` prints idle and launches no work;
   - no run + `--stop` prints a no-op and creates no misleading active state.
7. Audit every parent-plan acceptance criterion. Check specifically that `extensions/index.ts` registers `/buck-loop`, b-flow stays unwired, no XState import exists under the new directory, invalid choices fail closed, and artifact-wins resume is covered.

## Risks

- Documentation can overstate autonomy. Keep the scope to existing plans, explicit invocation, sequential phases, and postcondition scans.
- An ADR that says only “XState is bad” will not protect the actual boundary. Record the invocation, trust, and artifact-authority constraints.
- Tests alone do not prove registration UX. Exercise status and stop through the real command surface.
- Guardrail output may include advisory debt. Report it without weakening the durable contract.

## Verification

- `vitest run extensions/buck-loop/__tests__`
- `npm run guardrails:check`
- Actual `/buck-loop --status` and `/buck-loop --stop` no-projection/no-run smoke.
- Fresh doc links and terminology check: `/buck-loop` always means runner; `/skill:b-loop` always means advisory stamper.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the session resumes here next turn.
