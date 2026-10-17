---
status: completed
date: 2026-10-03
subject: 2026-10-03.buck-loop-commit-phase-identity
topics: [buck-loop, commit-checkpoint, phase-identity, retry, restart-recovery]
informs: [plan-commit-phase-identity.md]
---

# Research: Buck-loop commit checkpoint phase identity

## User Goal

Plan a repair that preserves the unfinished phase commit across failure, retry, and restart without weakening Git admission safeguards.

## Observed incident

The [diagnosis](../2026-10-01.skill-command-viability/research-commit-checkpoint-failure-2026-10-03.md) records the actual refusal, projection, transition timestamps, Git state, and read-only resume smoke. The first commit attempt targeted Phase 1; the retry targeted Phase 2. Phase 1's intended changes remain staged, not committed. The unrelated-path refusal is correct. No commit, staging, production resume, or projection mutation was performed during diagnosis or planning.

## Source findings

- `extensions/buck-loop/loop.ts`: `FROZEN_PHASE` excludes `committing`; `executeSkill()` rescans after a failed worker, so the scanner can replace the commit target before retry. `prepareCommitCheckpoint()` rejects unrelated unstaged paths before invoking the commit worker. Keep that boundary.
- `extensions/buck-loop/persist.ts`: version-1 projections carry phase identity but no pre-commit Git baseline. `keepCompletedProjectedPhase()` can derive confirmed work from a completed phase file; that is insufficient evidence for an interrupted commit.
- `extensions/buck-loop/scan.ts`: the committing postcondition currently treats a clean working tree/index as confirmation. Cleanliness alone cannot distinguish no commit from a completed commit.
- `extensions/buck-loop/machine.ts`: blocked work can return to resolving, and committing can advance through the ambiguous-choice path. Recovery needs a disjoint commit-checkpoint route, while non-commit ambiguity remains unchanged.
- `withTransition()` resets work facts on a state change. Recovery must derive commit proof after confirmation rather than trusting pre-transition facts.
- Existing tests use real temporary Git repositories. Extend the supervisor, scanner, persistence, and machine behavior cases rather than asserting source text or mocked Git echoes.

## Chosen design

Persist one nullable checkpoint marker containing the exact target path and positively observed pre-commit HEAD. Retain it through failure, retries, blocks, and restarts. Advance only after verified Git commit evidence; never infer a commit from worker prose, phase completion, or cleanliness alone. Recover an already completed checkpoint without launching a duplicate commit worker. Missing or invalid legacy evidence fails closed with manual recovery guidance rather than guessing a baseline or phase.

The plan retains exact phase-owned staging, unrelated-change admission, SQL-save receipt verification, and existing retry limits. The current drifted checkpoint still requires operator completion of Phase 1 before explicitly starting Phase 2; the repair must not fabricate retrospective proof.

## Verification evidence and limits

The incident diagnosis includes an exercised read-only Bun smoke: the existing blocked projection reconciles to Phase 2, USER_CONFIRMED returns resolving, and the next pure transition selects building. This demonstrates the unsafe prospective resume path without running it.

Planning used current source, LSP references for exported types, existing test fixtures, docs, the deterministic check contract, and supplied project history. Native `jev-1.13.0` reviewed the full draft: all seven closed coverage questions answered yes (failure identity, successful advance, restart, legacy safety, scope, verification, rollback). This is plan coverage validation, not runtime proof of the proposed repair. Implementation tests and fresh-process scenarios remain acceptance requirements in the [plan](plan-commit-phase-identity.md).

Artifact smoke: the canonical `scanContextDir()` validator classified the new plan, research, and backlog item with zero validation errors and no missing artifacts. `subject-lifecycle.ts inspect` reported canonical `active`, revision 2; open plan/acceptance blockers are expected before implementation. Planning changed only `.context/` artifacts; the implementation check gate was not run.

## Documentation impact

Update checkpoint semantics in `docs/buck-workflow.md`, legacy/operator recovery in `docs/howto/recover-buck-loop.md` and `docs/howto/resume-buck-loop-after-repair.md`, and `docs/CHANGELOG.md` after behavioral smoke proof. `docs/buck-loop.md` is activity-card documentation and is not the recovery destination.

## Related work

The [save/commit handoff plan](../2026-09-30.buck-loop-save-commit-handoff/plan-save-commit-handoff.md) owns different save/staging concerns. Do not rewrite it or absorb independently owned SQL-save changes into this repair.
