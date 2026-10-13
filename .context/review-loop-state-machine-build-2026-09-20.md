---
date: 2026-09-20
domains: [extensions, testing, architecture]
topics: [code-review-iteration, state-machine, pure-evaluator, resume, guardrails]
related:
  - reusable-state-machine-phase-3-build-2026-09-20.md
priority: high
status: completed
subject: 2026-09-20.review-loop-state-machine-alignment
artifacts:
  - plan-review-loop-state-machine-migration.md
  - review-zz-buck-loop-2026-09-20T19-49-05-686Z.md
  - draft-commit.md

# Review-loop state-machine migration build

Migrated `extensions/code-review-iteration/loop.ts` from scattered lifecycle branches to `extensions/code-review-iteration/machine.ts`, the second production consumer of the shared synchronous evaluator. The machine owns named automatic rules and terminal reasons; `loop.ts` remains the sole owner of catalog, git, model, artifact, resume, persistence, and report effects.

## Decisions

- Machine state is ephemeral and derived from persisted pass artifacts when resuming; `RunState` remains schema version 1.
- The incomplete-fixer artifact shape resumes directly at triage. Other retained runs preserve the prior next-pass behavior. A pass-bound resume projects to `passes-exhausted`, preserving the old `while` fallthrough without falsifying persisted fixer checks.
- `review-parsed` emits an explicit no-effect output so triage remains a separate pure decision and no `triage-findings` host effect exists.
- Machine failures cross one boundary: `MachineFailure` becomes a durable `failed` outcome containing `code` and structured `context`.

## Verification

- Baseline before migration: existing `loop.test.ts` passed 24/24.
- Machine truth table and finite-domain exclusivity tests passed; named unreachable combinations accept only `NO_ROUTE`.
- Machine failure integration injects `NO_ROUTE` and observes a persisted failed report containing code and context.
- Existing `loop.test.ts` remained byte-unmodified and passed 24/24, including notify-string, final-pass fixer, resume, rebase, and cancellation scenarios.
- Final `extensions/code-review-iteration/__tests__/` suite passed 159/159 after the pass-bound resume refinement.
- Throwaway projection smoke traversed `preflight-pending → preflight-ok → base-ready → review-parsed → triage-clean`; script deleted.
- Durable guardrails v2 passed after refactoring `executeMachineOutput` below the complexity ceiling: unit, global ratchet, and complexity required gates passed. Coverage was 81.8% against the 79.4% baseline. Patch coverage was unavailable (`null`) and therefore advisory; lint was disabled/skipped.
- Whole-repository `tsc --noEmit` remains unsuitable as a project gate and reported pre-existing errors across unrelated extensions and Bun scripts; no changed-file error appeared in that output.

## Review and save

- Final `/b-review` verdict: **Pass with warning**; no in-plan or out-of-plan findings. The only warning was the advisory patch gate reporting unavailable patch coverage; every required gate passed.
- Documentation impact was already satisfied by the ADR amendment; no how-to change was required.
- No phased or iterate artifacts exist for this subject. No backlog item was explicitly completed or newly deferred.
- The user goal is present and the completed plan is cross-referenced to this memory. Pre-close lifecycle inspection reports one expected blocker: the canonical authority does not yet define verified close evidence for an unphased plan.

## Files modified

- `extensions/code-review-iteration/machine.ts`
- `extensions/code-review-iteration/loop.ts`
- `extensions/code-review-iteration/__tests__/machine.test.ts`
- `extensions/code-review-iteration/__tests__/loop-machine-failure.test.ts`
- `docs/adr/0002-observably-invoked-happy-path-loop.md`
- `.context/2026-09-20.review-loop-state-machine-alignment/plan-review-loop-state-machine-migration.md`
