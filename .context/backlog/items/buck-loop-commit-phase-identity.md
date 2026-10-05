---
title: Preserve Buck-loop commit checkpoint identity
status: active
priority: high
created: 2026-10-03
updated: 2026-10-03
completed: null
related:
  - .context/2026-10-03.buck-loop-commit-phase-identity/plan-commit-phase-identity.md
  - .context/2026-10-03.buck-loop-commit-phase-identity/research-commit-phase-identity.md
  - .context/2026-10-01.skill-command-viability/research-commit-checkpoint-failure-2026-10-03.md
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/persist.ts
  - extensions/buck-loop/machine.ts
---

# Preserve Buck-loop commit checkpoint identity

## User Goal

Retry or restart a failed phase commit without advancing prematurely, duplicating a completed commit, or including unrelated work.

## Problem

The 2026-10-03 cleanup run attempted to commit Phase 1, then rescanned to Phase 2 during failure handling. The unrelated-change guard correctly refused the commit, but the persisted blocked projection now points at Phase 2 while Phase 1 remains staged and uncommitted. A read-only resume smoke selects Phase 2 building. See the [incident record](../../2026-10-01.skill-command-viability/research-commit-checkpoint-failure-2026-10-03.md).

## Acceptance

- Preserve the exact checkpoint target and pre-commit HEAD through refusal, worker failure, retry, block, and fresh-process restart.
- Advance only after verified commit evidence; do not treat completed phase files, clean Git state alone, or worker success as proof.
- Recover already committed checkpoints without launching a duplicate commit worker; missing/invalid legacy evidence remains blocked for manual recovery.
- Keep unrelated-change admission, exact phase-owned staging, SQL receipt verification, and retry limits unchanged.
- Prove two-phase success and both crash windows with real Git fixtures, focused/full suites, fresh-process smoke, and the required guardrails gates. Update recovery docs after smoke proof.

The plan contains the complete ten-item acceptance contract and rollback validation paths.

## Pickup

[Implementation plan](../../2026-10-03.buck-loop-commit-phase-identity/plan-commit-phase-identity.md) — `/b-build hard`, in a clean dedicated repair branch/worktree. This is separate from save/commit handoff and SQL-save receipt-subject repairs. Do not resume or hand-edit the incident projection; the current legacy drift still requires operator completion of Phase 1 before explicitly starting Phase 2.
