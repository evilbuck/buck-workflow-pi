---
status: completed
date: 2026-10-15
subject: 2026-10-10.durable-storage-adapters
topics: [save, receipts, conditional-revisions, adapter-authority]
informs: []
---

# Save attempt repair

## Assigned scope

R6: one persisted attempt and exact complete durable receipt/readback for facts and metadata in standalone and loop save entrypoints. No local completion flag authorizes success.
R3 (save only): conditional revisions, existing typed links and canonical subject-relative identity; scoped correction of moved/deleted source artifacts.
R1 (save preflight): adapter-authoritative discovery/read with no `.context` prerequisite or local outage fallback, across repo-files, external-files, SQLite and PostgreSQL.

Owned code: `extensions/b-save-improved/`; `extensions/buck-loop/sql-save.ts` and its tests; `skills/b-save-improved/scripts/save-preflight.ts`, `save-apply.ts` and their tests. Preserve staged LTM privacy repair. Shared files are read-only. No staging, commits, lifecycle/loop state or assigned iteration artifact completion.

## Exact owned paths changed

- `extensions/b-save-improved/index.ts`
- `extensions/b-save-improved/__tests__/save-phase.test.ts`
- `extensions/b-save-improved/__tests__/wire.test.ts` — preserved the staged privacy repair; changed only the golden checkpoint replay to refresh CAS anchors.
- `extensions/buck-loop/sql-save.ts`
- `extensions/buck-loop/__tests__/sql-save.test.ts`
- `extensions/buck-loop/__tests__/sql-save-store.test.ts`
- `extensions/buck-loop/__tests__/sql-save-guards.test.ts`
- `extensions/buck-loop/__tests__/sql-save-client.test.ts`
- `extensions/buck-loop/__tests__/sql-save-adapters.test.ts` — new.
- `skills/b-save-improved/scripts/save-preflight.ts`
- `skills/b-save-improved/scripts/save-preflight.test.ts`
- `skills/b-save-improved/scripts/save-apply.ts`
- `skills/b-save-improved/scripts/save-apply.test.ts`
- `.context/2026-10-10.durable-storage-adapters/research-repair-save-attempt.md`

## Implementation

- R6: one attempt ID and one native-bound receipt run own fact persistence, metadata sealing, and completion. The durable attempt stores exact fact inputs/revisions, metadata keys/revisions/SHA-256, and retired source keys. A workspace-scoped durable pointer recovers that attempt without local exports.
- `completeSaveAttempt()` is asynchronous. It requires durable metadata evidence, confirms exact revision bytes and source tombstones, completes the matching attempted receipt, and reads back the exact project/branch/worktree/run/attempt/kind/revision set/duties before exporting `completed: true`. `verifySqlSave()` is read-only; it never manufactures a missing receipt or metadata duty.
- Receipt `artifactRevisions` remains the exact fact revision set; the existing no-fact contract requires `[]`. Metadata revision evidence is retained under the same attempt, not an unrelated receipt run. Required duties are exactly `save-metadata` plus `readback` (rows) or `probe` (no-fact).
- The standalone extension awaits durable completion; portable loop saves receive executable `sql-save.ts facts` → `save-apply.ts` instructions. File-mode apply also completes and reads back its durable receipt rather than leaving attempted evidence.
- Explicit `SaveStoreDeps.identityPath` is threaded through the supported native receipt-binding operation. Replays recover the existing run without restamping a complete receipt. Interrupted receipt/pointer writes can be repaired from exact durable fact evidence; no metadata success is inferred.
- R3: preflight captures canonical source revisions/text, apply checks the captured revision before mutation, and writes use that predecessor as CAS. Typed links survive updates and moves. Published predecessors are corrected/tombstoned only in the caller's branch, leaving the owning branch unchanged.
- Moves/archive operations and explicit captured deletions tombstone the original scoped key. Deleted source exports are removed after correction and cannot be recreated by lifecycle/metadata updates in that save. Root lifecycle identity remains distinct from nested index documents.
- R1: both save paths share `readSaveSources()`. Non-repo adapters never read `.context` as an authority or outage fallback. Repo-files may read an initial editable projection only when the canonical identity is absent, with explicit create-only CAS (`expectedRevision: null`). Discovery works without `.context`; nested names remain subject-relative, and subject-scoped SQL facts never acquire phantom Markdown projections. Standalone phase provenance uses adapter preflight rather than directory reads.
- Cohesive refactors keep new source functions within cyclomatic complexity 10. No contract, enforcement, baseline, or timeout was changed.

## Verification

Final fresh focused Vitest run: **197 passed / 197**, **11 files**, exit **0**. Includes the unchanged `project-memory.test.ts` consumer (15 passing tests), standalone extension suites (41), save preflight/apply suites (52), receipt/loop-save suites (33), and a **56-case real four-adapter matrix**.

The matrix exercises rows/no-fact loop-prepared attempts, standalone file-mode completion, stale CAS refusal, link preservation, adapter-only archive moves and explicit source deletion (including root index), branch-local correction of published predecessors, explicit identity registries with native receipt readback, interrupted attempt-pointer repair without duplicate facts, and fact/metadata/receipt/readback faults. Every tested fault refused success.

Executed focused command (with a disposable PostgreSQL URL supplied through `BUCK_WORKFLOW_TEST_DATABASE_URL`):

```sh
npx vitest run extensions/b-save-improved extensions/buck-loop/__tests__/sql-save.test.ts extensions/buck-loop/__tests__/sql-save-store.test.ts extensions/buck-loop/__tests__/sql-save-guards.test.ts extensions/buck-loop/__tests__/sql-save-client.test.ts extensions/buck-loop/__tests__/sql-save-adapters.test.ts extensions/buck-loop/__tests__/project-memory.test.ts skills/b-save-improved/scripts/save-preflight.test.ts skills/b-save-improved/scripts/save-apply.test.ts
```

Actual runtime smoke, not a model/mock-host test: **12/12 CLI scenarios**, exit **0**. Each used the configured production adapter, native artifact writes, actual preflight CLI with `.context` absent, actual facts CLI for SQL-body mode, and actual apply CLI. Exact complete receipts were read again after removing both local attempt/receipt exports. SQL-body scenarios also passed production `verifySqlSave()` after removal.

| Adapter | Mode | Durable run | Fact revision |
|---|---|---|---|
| repo-files | rows | `run-db59d06d-76ab-4228-91ec-6557a5945703` | `d6a1a724-4d44-482c-bf1a-f05fad1d6cf6` |
| repo-files | no-fact | `run-9fa3c1f0-5776-489f-9202-5782b5bd5977` | `[]` |
| repo-files | file | `run-a6ca4178-af26-43a3-9a9f-e150a95feb96` | `[]` |
| external-files | rows | `run-e535af7f-d108-4d4c-ba79-8c970b44d9d3` | `d2d1bcda-0369-4194-8c61-5ae9f6bf7893` |
| external-files | no-fact | `run-be3ae9c6-0c22-42eb-a6c1-47cd881262ac` | `[]` |
| external-files | file | `run-c0e59ac8-52e4-4135-8e76-13b918fb4f78` | `[]` |
| sqlite | rows | `run-14542a62-6915-4ef7-8ec1-d7435a9379c1` | `f8adc838-9a22-4eee-962f-83fa3022666c` |
| sqlite | no-fact | `run-0914b107-34f4-462d-a9d8-4eca2206475b` | `[]` |
| sqlite | file | `run-59074dcd-3d69-4a1e-bb69-b3383a2f9b94` | `[]` |
| postgres | rows | `run-1028123c-4d93-4295-a69a-0986bfaf50ba` | `59b79fd9-1d47-4c4c-90b6-4c5cd0139d9c` |
| postgres | no-fact | `run-e93a8d72-c602-4995-89a6-fe16666a4ffa` | `[]` |
| postgres | file | `run-5d1cb626-a585-4cd0-bd89-56ff790936b6` | `[]` |

Every row returned `status: complete`; rows duties were `["save-metadata","readback"]`, and no-fact/file duties were `["save-metadata","probe"]`. Run/attempt identity, revisions, and exact duties matched the repeated native receipt read.

Fresh LSP diagnostics: no errors for `sql-save.ts`, `save-apply.ts`, or `save-preflight.ts`.
Focused `lizard -C 10 -w --csv` on owned sources and the adapter regression file found **no new hotspots**. Only the already-recorded extension baselines remained: `parseArgs` 13 and `runBSaveImproved` 27. Other changed tests also had no function above 10.

At slice handoff, full guardrails and artifact completion were reserved for the integration owner. The coordinator subsequently passed the unchanged full durable-v2 contract; see the closeout below.

The temporary runtime smoke script and the isolated PostgreSQL test container were removed after verification. No unrelated service was stopped.

## Original integration handoff (resolved)

- `completeSaveAttempt()` is now asynchronous and refuses completion without durable metadata evidence. Unowned legacy fixtures in `extensions/buck-loop/__tests__/loop.test.ts` (three direct calls found by LSP) and `extensions/buck-loop/__tests__/run-step.test.ts` must replace local `writeReceipt()` + unawaited completion with awaited `saveSqlFacts()` → successful metadata application/`recordSaveMetadata()` → awaited `completeSaveAttempt()`. The run-step fixture must verify against that same configured store/trusted context, not an unrelated empty injected store. Local-only completion fixtures no longer satisfy R6; do not restore the old authority.
- The supervisor's portable `/b-save` child must follow the executable facts/apply pipeline in `saveDirective()`, not manually stamp `completed: true` on JSON. No shared skill file was edited.
- No shared identity-path change is needed for save: the owned implementation now uses the supported native receipt seam with explicit identity/config options, and all four explicit-registry regressions passed.

Coordinator closeout: loop/run-step fixtures now await facts, successful metadata
sealing and complete readback on the same configured store; all six selected
recovery cases passed without the obsolete live-SQL skips. Canonical/bundled
b-save instructions require the executable facts/preflight/apply pipeline;
b-save-improved guidance carries the canonical snapshot and same receipt.
Final unchanged durable-v2 guardrails passed: unit/ratchet/complexity green,
89.2% coverage against 84% baseline. Detailed final output and limits are in
research-repair-shared-review.md. No native identity-path change was needed for
save. Supervisor retains review/save/commit and loop-state authority.
