---
date: 2026-07-10
domains: [implementation, testing, buck-workflow, lifecycle, docs]
topics: [b-save, closeout, review-pass, phase-state, backlog-promotion, idempotency, wrappers, living-docs]
related:
  - .context/2026-07-10.buck-workflow-implementation-audit/phase-2-save-owned-closeout.md
  - .context/2026-07-10.buck-workflow-implementation-audit/plan-buck-workflow-contract-remediation-phases.md
  - .context/2026-07-10.buck-workflow-implementation-audit/review-pass-phase-2-save-owned-closeout.md
  - .context/backlog/archive/2026-07/phase-2-save-owned-closeout.md
priority: high
status: completed
subject: 2026-07-10.buck-workflow-implementation-audit
artifacts:
  - phase-2-save-owned-closeout.md
  - review-pass-phase-2-save-owned-closeout.md
  - draft-commit.md
  - plan-buck-workflow-contract-remediation-phases.md
---

# Phase 2: Save-owned Closeout — Completed

## Outcome

`b-save` is the sole deterministic closer of accepted workflow state. The skill owns the full closeout contract; `prompts/b-save.md` is a thin loader. Intermediate Phase 2 closeout completed the phase/overview row, archived its backlog item, promoted Phase 3 once, completed session memory, and left the subject active.

## Decisions

- Keep `b-save` prompt-driven; no extension or plugin owns closeout.
- Model the deterministic state transition as pure `closeAcceptedUnit` over normalized lifecycle state.
- Use the active review-pass as the recovery marker and complete it last.
- Intermediate closeout archives the current phase backlog item and promotes only the first dependency-ready phase.
- Final/non-phased closeout completes linked parents but closes the subject only when no other workflow unit remains active.
- Missing pass, invalid target/status/verdict, stale fingerprint, active iterate, or incomplete topology refuses before mutation.
- QMD is optional-if-installed and cannot fail save.
- Living narrative updated under `/b-docs`: save modes, staging boundary, ADR 0001 expansion, AGENTS completion sequence.

## Verification

- Review-pass fingerprint matched implementation paths at save time.
- `npx vitest run scripts/lifecycle-closeout.test.mjs scripts/lifecycle-artifacts.test.mjs scripts/context-artifacts.test.mjs` — 76 tests passed.
- `readlink commands/b-save.md` → `../prompts/b-save.md`.

## Closeout

- Phase 2 `status: completed`, `completed_by: b-save`.
- Overview Phase 2 row `completed`; overview/parent/subject remain `active`.
- Next exposed backlog item: Phase 3 stage/commit safety.
