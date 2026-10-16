---
status: completed
phase: 5
order: 5
plan: plan-durable-storage-adapters.md
phases_overview: plan-durable-storage-adapters-phases.md
difficulty: medium
model_hint: capable general model preferred
buck_hint: /b-build
goal: "Migrate every remaining Buck-owned durable consumer (save pipelines, loop persistence, hooks, attribution, import manifests, retained packages, plan-site reader) onto the storage contract, keeping host-owned data untouched."
files:
  - extensions/buck-loop/
  - extensions/b-save-improved/
  - skills/b-save-improved/scripts/
  - extensions/turn-memory/
  - hooks/post/turn-memory.ts
  - extensions/plan-artifact.ts
  - extensions/token-attribution/
  - extensions/code-review-iteration/
  - skills/b-memory-import/
  - docs/plans/src/lib/plans/
from_plan_steps: [5]
sql_memory_ids:
  - 01a142ea-44af-78b1-9b4f-afb0fc5a9503
depends_on: [4]
dependency_type: HARD
acceptance_criteria:
  - "[x] Both save pipelines (buck-loop and b-save-improved preflight/apply) write same-adapter batches/attempt receipts through one storage contract."
  - "[x] Loop resume/scan/checkpoint/activity, review pass artifacts/state, post-turn memory hook, Buck attribution and dedupe records, and import manifests all persist via the service; run-private scope retained after branch merge."
  - "[x] Retained presentation packages and attachments adapter-backed (binary intact); generated presentation exports may remain user deliverables."
  - "[x] Plan-site reader (docs/plans/src/lib/plans/) reads adapter-backed source through its existing reader seam; fake SQL stub removed once replaced; no UI redesign."
  - "[x] Host-owned OMP session/stats/LTM rows untouched; no LTM mirroring of unmerged knowledge."
  - "[x] Persistence inventory from Phase 1 fully reconciled: every listed path migrated or explicitly verified unchanged."
completed_at: 2026-10-16
completed_by: null
---

# Phase 5: Remaining Durable Consumers

## User Goal
Technical chore — consumer migration; the inherited parent goal is: users can choose durable storage per project and keep unmerged work invisible on other branches.

## Context
Parent User Goal: choose durable storage, resume reliably, branch-private unmerged work. Needs the Phase 4 native/CLI surface. Plan step 5. Execution policy in code-review-iteration is unchanged — only its retained persistence moves.

## Implementation Details
1. Migrate both save pipelines and loop persistence (scan, persist, project-memory, save/checkpoint, subject picker evidence) to the service; retain machine rules (never-invent, repairing-state) untouched.
2. Migrate hooks (`hooks/post/turn-memory.ts`, `extensions/turn-memory/`), `extensions/plan-artifact.ts`, Buck-owned `extensions/token-attribution/` persistence (never host stats/session rows).
3. Migrate `extensions/code-review-iteration/` pass/state/report persistence; immutable pass artifacts semantics preserved under the adapter.
4. `b-memory-import` manifests and retained presentation/attachment outputs through export/import ops; mirror only published knowledge into harness LTM.
5. Connect plan-site reader to adapter-backed source via the existing seam; remove the fake SQL stub; no UI work.

## Risks
- Broad file spread but mechanical per-slice once the contract exists — this is why it is medium, not hard.
- `promisify(execFile)` convention required (no `node:child_process/promises` on this machine).

## Verification
- Focused scenarios per state kind: presentation attachment round-trip, retained pass audit, hook memory write, attribution/import cursor — read back exact IDs/revisions.
- Two-worktree fixture: concurrent runs never share mutable resume pointers.
- `npm run guardrails:check` passes.

## Repair Checkpoint (2026-10-13, first build pass)

Landed: consumer contract (`skills/_shared/storage/consumers.ts`) with same-store
batch + attempt receipt; `saveSqlFacts` receipt via injected store or
`workflow_state write-receipt`; b-save-improved on the same function;
turn-memory through the configured store (host session entries untouched);
plan-site SQL stub replaced by `SqlPlanSource` reading visible plan artifacts;
SQLite mirrors for resume bookmark, review `state.json`, import manifests, and
Buck attribution rows (host `messages` rows never written). 30 focused tests
pass.

Remaining gaps — do not tick boxes until these land:

1. File-mode `save-apply` still writes `.context` directly; route it through
   the consumer batch helper.
2. Review pass artifacts other than `state.json` (pass reports, fixer/command
   evidence) are not yet on the store.
3. Presentation/retained-package writers are not on the batch helper.
4. Postgres attribution/import sync callers are not on the shared batch path.
5. Persistence-inventory reconciliation against the Phase-1 census (every row
   migrated or explicitly excluded) is incomplete.

## Repair Checkpoint (2026-10-13, second build pass — gaps closed)

All five first-pass gaps landed; see `implementation-notes-phase-5.md` for the
full record. Summary:

1. File-mode `save-apply` seals every applied byte plus one attempt receipt on
   the configured store (`sealAppliedBytes` via `withConfiguredStore`); seal
   failure fails the apply.
2. Review pass `review.json/md`, `fixer.json/md`, `commands.jsonl`, final
   reports, and `state.json` retain on the configured store; immutable-refusal
   semantics preserved.
3. `retainPresentationPackage` + `b-present` Step 6b script retain exact
   package bytes (binary intact, symlink refusal).
4. `mirrorSqliteArtifact` removed; attribution rows, import manifests, loop
   audits/activity/resume, and ranking writes retain through the configured
   adapter (sqlite/postgres/external-files) with receipts.
5. `persistence-inventory.md` § Phase 5 reconciliation records every census
   row as migrated, projection, or excluded-by-design.

Verification: `env -u SQL_MEMORY_URL npm test` 1931 passed / 0 failed; bun
suites pass; bundle parity restored (consumers.ts + drifted first-pass files
shipped); guardrails re-run after the pre-existing `authorizeCheckoutPath`
complexity regression (introduced by 202ca5d, ungated) was refactored under
threshold with behavior-preserving gates.

## Operator closeout (2026-10-15)

Checked after the receipt-run fix. A bound workspace now allocates a receipt
run per attempt (`bindAttemptRun`); an explicit `context.runId` is only the
fallback when no workspace record exists. Verification seals an attempted
store receipt before marking it complete. Vitest workers keep identity off
the operator home via `BUCK_VITEST_CONFIG_HOME`.

Repo-files readers still use the checkout projection; the store holds the
sealed copy. Cross-worktree reads for postgres/external-files stay with
Phase 6. End-to-end per-adapter proof stays with Phase 8. Those boundaries
are the inventory reconciliation, not open Phase 5 boxes.


## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only (escalate to `/b-build-hard` if ambiguity appears).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
