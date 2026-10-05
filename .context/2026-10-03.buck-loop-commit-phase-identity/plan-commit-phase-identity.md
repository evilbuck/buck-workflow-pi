---
status: active
date: 2026-10-03
subject: 2026-10-03.buck-loop-commit-phase-identity
topics: [buck-loop, commit-checkpoint, phase-identity, retry, restart-recovery]
research: [research-commit-phase-identity.md]
iterations: []
spec: null
memory: []
difficulty: hard
buck_hint: /b-build
files:
  - extensions/buck-loop/types.ts
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/persist.ts
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/__tests__/loop.test.ts
  - extensions/buck-loop/__tests__/persist.test.ts
  - extensions/buck-loop/__tests__/scan.test.ts
  - extensions/buck-loop/__tests__/machine.test.ts
  - extensions/buck-loop/__tests__/wire-status.integration.test.ts
  - docs/buck-workflow.md
  - docs/howto/recover-buck-loop.md
  - docs/howto/resume-buck-loop-after-repair.md
  - docs/CHANGELOG.md
---

# Plan: Preserve Buck-loop commit phase identity through failure and restart

## User Goal

Operators can retry or restart a failed phase commit without starting the next phase prematurely, duplicating a completed commit, or including unrelated work.

## Goal

Keep the unfinished commit checkpoint's target and Git baseline authoritative until its commit is verified. Only then select the next incomplete phase. A completed phase file is build evidence, not commit evidence.

## Context used / assumptions

- Input: the operator's commit refusal and this session's diagnosis; see [the incident record](../2026-10-01.skill-command-viability/research-commit-checkpoint-failure-2026-10-03.md).
- At diagnosis, the first checkpoint targeted Phase 1 at 2026-10-03T15:10:54.388Z; its retry targeted Phase 2 at .411Z; the run blocked at .427Z. Phase 1 was staged but uncommitted, and Phase 2 was pending.
- Current source: committing is absent from FROZEN_PHASE; executeSkill rescans even after prepareCommitCheckpoint throws; rescan therefore takes the next incomplete phase. Persistence keeps a completed projected phase but synthesizes confirmed work from phase completion. Blocked USER_CONFIRMED currently resolves/builds rather than recovering a commit.
- The current committing postcondition is a clean Git status after an ok child outcome. Projection carries no pre-commit Git baseline. Crash recovery cannot safely distinguish a never-run commit from a commit completed before the projection was updated.
- Scope guard already supports phase-declared paths plus .context and correctly refuses unrelated unstaged paths. SQL receipt verification already reached committing in this incident; do not reopen that repair here.
- Related but distinct: [save/commit handoff plan](../2026-09-30.buck-loop-save-commit-handoff/plan-save-commit-handoff.md). Its teardown and declared-file staging work does not repair this phase-identity defect.
- Buck capability: full; probe source: injected active-session skill catalog resolving b-build, b-review, and b-save. Reuse the supplied project history and current diagnosis; no new SQL memory query or save receipt is required for this plan.

## Decision Closure

**Selected course:** use the existing projection, Snapshot vocabulary, scanner postcondition pattern, and compiled machine. Add one bounded commit-checkpoint record, pin its target through unsuccessful commits, and route explicit commit recovery through the machine. No separate journal, dependency, new orchestration engine, or model-selected commit bypass.

**Evidence:** the real log's changed target, staged Phase 1, FROZEN_PHASE/rescan behavior, clean-status-only POSTCONDITION.committing, and persistence's completed-phase shortcut. A read-only machine probe selected resolving then building Phase 2 from the blocked incident.

**Excluded scope:** changing staging admission, adopting unrelated dirty work, SQL save protocol changes, skill cleanup, a general Git-safety refactor, and automatically repairing the already-drifted historical projection.

**Next bounded action:** add the two-phase public-supervisor regression cases in an isolated repair worktree, then implement the complete checkpoint invariant as one coherent cutover.

## Assumptions Ledger

| id | statement | status | blocking | evidence / validation_path |
|---|---|---|---|---|
| A-1 | The retry target changes before a successful commit, not after a genuine Phase 2 build. | validated | false | Incident timestamps, staged Phase 1, and executeSkill/rescan source. |
| A-2 | Existing projection and phase completion alone cannot prove an interrupted commit happened. | validated | false | Projection has no Git baseline; keepCompletedProjectedPhase confirms from phaseFileDone; committing scanner checks clean status only. |
| A-3 | Existing drifted commit projections without a checkpoint marker must use operator recovery, not an inferred previous phase. | validated | false | Incident projection points at pending Phase 2 while the uncommitted checkpoint belongs to Phase 1. Selected fail-closed policy; validate the literal legacy incident fixture in Step 4. |
| A-4 | The existing SQL-mode test environment can exercise receipt-bound commit recovery. | validated | false | 2026-10-03 iteration exercised real disposable PostgreSQL 18 + pgvector with the canonical migration and SQL_MEMORY_TEST_URL; marker-backed valid/stale receipt regressions passed. See research-iteration-verification.md. No shared database was used. |

## Scope

- Commit target identity from initial committing entry through guard failure, child failure, automatic retry, ambiguous postcondition, block, and process restart.
- Minimal persisted Git-baseline evidence needed for idempotent recovery when the commit happened before a crash.
- Explicit USER_CONFIRMED commit recovery through the real machine; unchanged retry and loop limits.
- Confirmed-only phase advance and final completion from committing. Other states retain their current ambiguity semantics.
- Exact operator guidance for a recoverable checkpoint versus a legacy/inconsistent checkpoint.
- Behavioral regression coverage using real temporary Git repositories and the public handleLoop seam.

## Out of scope

- Do not stage, stash, delete, commit, or move the current checkout's unrelated SQL-save, synopsis, or plan-browser work as part of implementing this fix.
- Do not widen files: declarations or relax prepareCommitCheckpoint/refuseDirtyWorkspace/protected-branch checks. Already-staged path policy is unchanged.
- Do not change SQL schema, receipts, saveAttemptId, save directive wording, or SQL teardown classification.
- Do not modify cleanup phase statuses, the blocked production projection, or historical receipts. No automatic log-based reconstruction of a missing checkpoint.
- Do not add retry allowances, telemetry, a dependency, aliases, or a parallel state representation. General fail-closed Git probe remediation remains its separate backlog item.

## Affected files

| Path | Change |
|---|---|
| extensions/buck-loop/types.ts | CommitCheckpoint vocabulary and optional nullable Snapshot checkpoint, following the existing saveAttemptId field convention. |
| extensions/buck-loop/persist.ts | Validate/serialize/reconcile the marker; retain its target without treating phase completion as commit proof. |
| extensions/buck-loop/loop.ts | Prepare and persist the marker before a commit effect; verify Git outcome; preserve/release target; rederive commit facts on resume; truthful recoveryFor guidance. |
| extensions/buck-loop/scan.ts | Thread verified commit evidence through the existing scan-options/postcondition seam, analogous to sqlSaveVerified; cleanliness remains required. |
| extensions/buck-loop/machine.ts | Commit-specific USER_CONFIRMED edge and confirmed-only commit advance; no ambiguous advance authority for committing. |
| extensions/buck-loop/__tests__/{loop,persist,scan,machine}.test.ts | Real Git outcomes, retry identity, crash-window idempotence, legacy holds, and disjoint machine edges. |
| docs/buck-workflow.md | Commit-phase ownership, proof requirement, and recovery contract near the existing durable-checkpoint section. |
| docs/howto/recover-buck-loop.md; resume-buck-loop-after-repair.md | Marker-backed resume versus manual legacy recovery; restart OMP before executing imported supervisor changes. |
| docs/CHANGELOG.md | Unreleased fix entry after smoke proof. |

All commit-entry, projection reconstruction, and machine fixture callers must adopt the new contract. LSP references were inspected for Snapshot and Projection; use them again during implementation. If a shared test builder actually needs a change, update it and add the exact file to this plan's declared scope before checkpointing; do not use a broad extensions/buck-loop/ prefix that would absorb sql-save.ts.

## Implementation steps

### 1. Lock down the public failure pattern

Extend existing isolated Git fixtures and handleLoop tests with two owned phases, a completed Phase 1, pending Phase 2, and an unrelated unstaged file introduced before commit. Assert the public progress target, persisted phase, Git index, and phase build/commit ordering—not only an internal freeze-set value. The out-of-scope refusal is given ground truth; reproduce this new regression in a disposable fixture, not by rerunning the user's failed checkpoint.

Also cover a child-reported commit failure with unchanged HEAD and a child reporting ok without producing a commit. The same phase and baseline must survive the existing single automatic retry and eventual block.

### 2. Persist a minimal commit checkpoint before effects

Define CommitCheckpoint with targetPath (the canonical repo-relative phase path, or plan path for unphased work) and baseHead (the full pre-commit Git object id; null only for a positively verified unborn repository).

Carry commitCheckpoint through Snapshot and Projection, using the existing optional-state-field pattern. New projection writes serialize an explicit null outside a checkpoint. Preserve projection version 1 and all current fields; a missing marker remains no proof, not a reconstructed marker.

Create and atomically persist the marker on the first transition into committing, before prepareCommitCheckpoint can fail or b-commit can run. Reuse the exact marker across retries, blocks, and resumes. Never reset baseHead to the current HEAD on a retry. Validate that targetPath belongs to the saved subject/plan; missing, malformed, or conflicting ownership blocks. Git probe errors block; do not reuse gitOutput's empty-string-on-error behavior for this evidence.

### 3. Pin until the real commit postcondition is confirmed

Keep checkpoint.targetPath as the active commit target across unsuccessful or ambiguous outcomes; assess commit facts against that target, not the scanner-selected next phase. Merely adding committing unconditionally to FROZEN_PHASE is insufficient.

Commit proof requires a successfully queried clean index/worktree and a real commit since baseHead: HEAD is the direct child of that baseline under the one-commit-per-phase rule, or the first root commit for a verified unborn baseline. HEAD unchanged is not success even when a worker says ok. Diverged/multiple-commit history or failed Git queries blocks with checkpoint identity intact, rather than guessing.

If HEAD advanced but the worktree is not clean, block for operator inspection; do not rerun b-commit and accidentally create a second checkpoint commit. After the tree is safely cleared, rechecking the unchanged baseline can recognize the existing commit without a duplicate child invocation.

Pass this deterministic proof through scan's existing postcondition pattern. Release phase identity and clear the checkpoint only when proof is confirmed and the advance is durably recorded; then select the next incomplete phase exactly once. A worker's final prose, phase status, or a model's advance choice cannot substitute for commit proof. Preserve normal final-phase and unphased eligibility checks.

### 4. Recover through explicit machine transitions

Persistence keeps the marker's valid target through committing and blocked-from-committing reconciliation. Do not synthesize confirmed commit facts in keepCompletedProjectedPhase solely because a phase file is completed.

Add a disjoint manual blocked -> committing USER_CONFIRMED edge for a validated pending/finished commit checkpoint. Ordinary blocked build/iterate recovery and its review edge stay unchanged. Recompute Git proof after applying the transition because withTransition resets cross-state workFacts. Recheck the existing SQL receipt/attempt contract before authorizing commit progress in SQL mode.

- Baseline HEAD with still-uncommitted work: resume the same phase's b-commit after the existing dirty-work admission checks pass; do not rebuild, re-review, or re-save that phase.
- Already-committed clean checkpoint: advance via confirmed commit facts without another b-commit.
- Missing marker on an interrupted commit, including the literal Phase 2 drift incident, or inconsistent ownership/history: retain blocked and give manual recovery guidance; do not fall back to resolving/building.

Restrict committing's advance/done guards to confirmed postconditions. Its ambiguous route may use the existing bounded retry/hold policy, but not model-authorized advance. Verify the compiled graph's guard sets remain disjoint and retry/loop ceilings unchanged. Do not manually assign runtime state or edit projection history to fake the new edge.

### 5. Prove behavior, then update operator contracts

Implement the regression matrix below using real Git commits, staged changes, and serialized projections. Reuse the existing controlled worker fixture at the model boundary; never mock the Git outcome under test.

After smoke evidence exists, update the two existing how-tos, workflow checkpoint prose, and changelog. Status must identify the retained checkpoint, whether an existing commit was verified, and whether explicit resume or manual recovery is appropriate. Remove stale blanket advice to resume every interrupted commit or to infer success from a completed phase. Preserve unrelated documentation and historical context records.

### 6. Run the coherent verification and checkpoint the fix

Use fresh processes and a disposable repository for the end-to-end scenarios. Run the focused suites, npm test, and the authoritative npm run guardrails:check. Any required gate failure blocks completion; report skipped/advisory gates as such without weakening the contract. Complete A-4's SQL-mode proof before claiming both memory modes verified.

Review against this plan, handle only in-plan defects, record durable state, and create one coherent fix commit. Do not resume the original blocked cleanup run during this implementation.

## Acceptance criteria

- [x] AC-1: Initial checkpoint refusal, automatic retry, and terminal block all retain Phase 1's target and immutable baseline; Phase 2 never builds or commits, and unrelated unstaged content/index entries remain untouched.
- [x] AC-2: A failed commit child with unchanged HEAD retains the same target/baseline through the existing retry ceiling. A child saying ok with no new commit cannot authorize advance.
- [x] AC-3: A real successful Phase 1 commit advances to Phase 2 exactly once; normal two-phase execution produces one commit per phase. The final verified commit can reach done without getting stuck on the completed phase.
- [x] AC-4: A fresh-process restart before the Git commit resumes only the retained Phase 1 checkpoint after USER_CONFIRMED; no Phase 2 build and no repeated Phase 1 build/review/save precedes it.
- [x] AC-5: A fresh-process restart after Git commit but before projection advance verifies that existing commit and advances without another commit child or duplicate commit.
- [x] AC-6: HEAD advanced with remaining dirt, divergent history, malformed/missing marker, lost target, or failed Git proof cannot advance or silently select another phase. After appropriate operator recovery, no second commit is created for a verified checkpoint.
- [x] AC-7: The actual legacy blocked/Phase-2 projection shape without a marker remains blocked with manual recovery guidance; no previous target is guessed from phase completion or log prose.
- [x] AC-8: Commit ambiguity cannot be lifted to advance by a model. Ordinary non-commit ambiguity handling, build/iterate USER_CONFIRMED recovery, counters, and existing staging/protected-branch gates retain their contracts.
- [x] AC-9: File mode and configured SQL mode exercise the same commit-identity behavior; a stale or mismatched SQL save receipt still cannot authorize commit progress. Unphased closeout eligibility remains enforced.
- [x] AC-10: Focused suites, npm test, required guardrails gates, and the disposable fresh-process smoke pass. Recovery docs/changelog match observed behavior; no production projection, receipt, cleanup-phase status, or unrelated work is mutated.

## Acceptance stamp

2026-10-04. AC-2 and AC-3 were stamped from `jev-1.13.0` at noul 0.73. Operator directed the remaining boxes checked.


## Verification

Commands for implementation—not claims of tests run during planning:

~~~bash
npx vitest run extensions/buck-loop/__tests__/loop.test.ts extensions/buck-loop/__tests__/persist.test.ts extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/machine.test.ts
npm test
npm run guardrails:check
~~~

Use the existing SQL test setup for SQL_MEMORY_TEST_URL; never print credentials. Expected gate contract: unit/global-ratchet/complexity required, patch coverage advisory, lint/functional disabled. Do not lower the 84% global baseline or complexity limits. Fresh diagnostics must be clean on the touched files; existing unrelated project-wide diagnostics are reported separately.

| Scenario | Observable proof |
|---|---|
| Phase 1 guard refuses unrelated dirt | All commit progress targets and stored checkpoint stay Phase 1; zero Phase 2 work; unrelated file bytes/index unchanged. |
| Commit child fails or lies about success | HEAD unchanged; no phase advance; same target/baseline across one retry then block. |
| Successful two-phase execution | Each real commit contains its phase's owned changes; second build starts only after first commit proof; final done. |
| Process exit before commit | New process reads the retained marker; first resumed work is Phase 1 commit, not build/save or Phase 2. |
| Process exit after commit before projection update | New process recognizes the real commit from baseline plus clean tree; commit count unchanged on resume. |
| Commit exists but dirt/history conflicts | Block without another commit invocation; marker preserved; clearing only intended dirt permits idempotent verification. |
| Legacy Phase 2 drift/no marker | Public resume/status hold for manual recovery; no worker runs and no projection is hand-repaired. |
| SQL stale receipt | Real existing receipt verification refuses it even if Git proof is otherwise valid. |

Fresh-process smoke: run the real supervisor and real Git in an isolated two-phase fixture; inject the refusal, exit, preserve/isolate only fixture-owned unrelated work, restart, explicitly resume, and observe Phase 1 commit before Phase 2 build. Repeat the after-commit/before-projection crash window. A controlled worker fixture is allowed only at the external model boundary; Git, scanner, persistence, and machine remain real. If verifying through the OMP command surface, fully restart OMP; /reload does not refresh imported supervisor modules. Remove disposable smoke artifacts afterward.

## Material Risks

| failure_mode | impact | mitigation | rollback_or_fallback | validation_path |
|---|---|---|---|---|
| Pin every committing rescan, including success | Completed phase repeats or never advances. | Release only on deterministic confirmed proof; cover next-phase and final-phase execution. | Stop the run; complete the intended checkpoint manually and explicitly start the next phase. | AC-3 plus manual fallback fixture in AC-7. |
| Treat completed phase/clean tree as commit proof | Skip an uncommitted phase or duplicate a crash-completed commit. | Persist baseline before effects, verify direct successor and cleanliness, rederive after USER_CONFIRMED. | Keep blocked and inspect the retained phase, real HEAD, and staged diff; never auto-infer an older phase. | AC-2, AC-4, AC-5, AC-6. |
| Resume an old or inconsistent projection automatically | Build Phase 2 while Phase 1 checkpoint is outstanding. | Missing/malformed marker and ownership mismatch fail closed; no legacy auto-migration. | Operator completes reviewed Phase 1 checkpoint, then explicitly starts Phase 2. | Literal incident-shape fixture and documented fallback, AC-7. |
| Widen staging scope or build in the dirty incident checkout | Independent work lands in the repair/cleanup commit. | Exact files: list and isolated repair worktree; guard unchanged. | Preserve unrelated work separately and keep the original run blocked. | AC-1/AC-8 inspect actual Git status/index and real commit contents. |
| Downgrade code with a new-format checkpoint in flight | Older runtime ignores the marker and repeats unsafe recovery. | Stop before reverting; retain a copy of the projection and resolve its intended checkpoint through operator review. | Finish the intended checkpoint manually and start the next phase explicitly before/after reverting the fix commit. | Disposable pending-checkpoint rollback rehearsal; verify old command recovery never receives an unresolved new marker. |

## Execution Instructions

This is one coherent repair, not an added cleanup phase. The runtime contract, machine edge, and persistence cutover must land together. The number of affected files qualifies for optional /skill:b-phase dispatch planning, but do not ship partial protocol/machine changes independently.

1. Use a clean dedicated repair branch/worktree. Carry only this repair's context records and referenced diagnosis. The incident checkout already contains staged Phase 1 and unrelated work; do not adopt its index or reset/stash it. Ensure separately owned SQL-save changes are resolved in the chosen base rather than folded into this commit.
2. Run /b-build hard against this plan, followed by /b-review. In-plan findings go through /b-iterate and re-review; out-of-plan findings require a separate plan.
3. Sync the specified living docs/how-tos after behavioral smoke proof, then /b-save and /b-commit for the coherent repair.
4. A fresh OMP process is required before using changed imported supervisor code. Do not use /reload as proof.
5. Existing drifted cleanup checkpoint: this fix will not fabricate its missing marker. Preserve unrelated work, review/complete Phase 1's staged checkpoint, verify its commit, and only then explicitly start Phase 2. Do not hand-edit the current projection or blindly --resume it.

## Planning Validation

Native `jev-1.13.0` reviewed the full draft against observed incident and source facts. All seven closed coverage checks passed: failed-commit target retention, successful advancement, restart recovery, legacy fail-closed behavior, scope preservation, verification coverage, and rollback coverage. This validates plan coverage only; no implementation test or repaired-runtime result is claimed.
