---
status: active
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
topics: [workflow-state, native-tool, skill-cutover]
related: [phase-4-native-access.md]
priority: high
---

# Phase 4 implementation notes

## Selected course

One `workflow_state` tool and matching CLI over the existing store. Trusted runtime binds project and branch incarnation. Callers cannot pass project or visibility scope. Restricted children get a baked role. Migration is CLI-only.

## Why not a new abstraction

The plan already named `skills/_shared/scripts/workflow-state.ts` and `extensions/workflow-state/`. The tool reuses `StorageStore`, `lookupKnowledge`, and the existing OMP `registerTool` shape. No new dependency.

## Evidence

- `skills/_shared/scripts/workflow-state.test.ts`: token scope rejection, role denial, receipt readback, branch-scoped search rank, incarnation reuse/rewrite, no `.context` mirror for sqlite/external-files, postgres opener ignores `SQL_MEMORY_URL`.
- `extensions/workflow-state/index.test.ts`: child tool cannot pass `projectId` or inspect.
- `extensions/plan-artifact.test.ts`: plan bridge still projects repo-files subjects and skips completed subjects.
- `extensions/buck-loop/__tests__/run-step.test.ts`: children receive `workflow_state`, never `sql_memory`.
- `extensions/buck-loop/__tests__/project-memory.test.ts`: recall searches the store without `SQL_MEMORY_URL`.
- `extensions/index.test.ts`: the subject picker passes `workflow-artifact:` tokens.
- `npm run guardrails:check`: pass. Coverage 88.6 against baseline 84. Complexity gate pass.

## Follow-up cutover

- `recallProjectMemories` searches `workflow_state` on the current branch. It no longer opens a SQL pool.
- The interactive subject picker discovers open subjects through the store and passes artifact tokens. Repo-files discovery imports known projection files.

## Deferred

- Publication pointer loading stays empty until phase 6. Callers still cannot supply `publishedRevisionIds`.
- Save-pipeline SQL inserts in `sql-save.ts` remain for the supervisor until phase 5. The child directive now says `workflow_state`, not `sql_memory`.
- `skills/b-save-improved` still documents SQL receipt ids. That extension is a phase 5 save consumer.
- `scripts/install.mjs` has no skill allowlist. Shipping is the canonical bundle, which was recopied and passed `scripts/codex-plugin.test.ts`.

## Material risk

A restricted child with `bash` can still invoke the CLI. The CLI binds the same trusted project and cannot take a caller project id. `inspect`/`recover` name a branch and write evidence. The enforced negative test is the injected tool role, not the shell.

## Acceptance wrap-up

Jev `jev-1.13.0`, second call after the recall and picker cutover. Threshold is 0.7. No box was checked.

- criterion 1, tool and CLI plus token inputs: 0.65, left open
- criterion 2, stage permissions and trusted binding: 0.20, left open
- criterion 3, CLI fallback and no unscoped SQL read: 0.27, left open
- criterion 4, model-facing SQL path removed: 0.50, left open
- criterion 5, plan bridge, picker, and every hardcoded path: 0.14, left open
- criterion 6, bundle, installer, ranking, and receipt readback: 0.11, left open

Phase stays `in-progress`. Supervisor save SQL and `b-save-improved` remain for phase 5. The installer has no skill allowlist; bundle parity passed, and that was not enough evidence for criterion 6.

## Repair pass (2026-10-12)

Selected course: reuse `executeWorkflowState` for supervisor fact writes. No new package or store method. `SQL_MEMORY_URL` stays the loop's save-mode gate so file-mode loops do not start requiring receipts; it is not opened as a pool.

Evidence:

- `sql-save.ts` has no `INSERT INTO`, memories `SELECT`, or `sqlMemoryRows`.
- Store tests cover revision-id receipts, retry, correction rejection, no-fact, missing revision, and write failure without a receipt.
- `skills/b-save-improved/SKILL.md` states revision-id receipt rules. Curated bundle has no `b-save-improved` twin.
- `node scripts/install.mjs --verify` storage section: 14 files `ok`. Exit 1 is harness split (`buck-workflow-pi` and `~/.pi`), not a missing storage file. `shippedStorageFiles` fails closed when those paths are absent.
- Guardrails: pass. Coverage 88.8 vs 84. Complexity pass.

Jev `jev-1.13.0`, third call. Threshold 0.7. No box checked.

- criterion 1: 0.22, left open
- criterion 2: 0.05, left open
- criterion 3: 0.24, left open
- criterion 4: 0.45, left open
- criterion 5: 0.06, left open
- criterion 6: 0.23, left open

Phase stays `in-progress`.
