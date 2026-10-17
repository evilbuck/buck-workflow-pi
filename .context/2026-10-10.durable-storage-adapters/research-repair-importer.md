---
status: completed
date: 2026-10-15
subject: 2026-10-10.durable-storage-adapters
topics: [importer, storage-consumers, checkout-binding, published-only]
related: [iterate-phase-5-current-state-2026-10-15.md]
---

# Importer R1/R2 repair

## Scope and decisions

Own only `skills/b-memory-import/scripts/import-context-memory.ts`, importer tests, and this evidence file. Preserve the dirty index; no shared-helper edits, staging, commits, loop state, or iteration-status changes. SQL recall supplied; no queries.

- Read memory/backlog source bytes and importer cursor from the selected configured service, never a filesystem union or outage fallback.
- Require trusted publication proof for every imported revision; do not implement Phase 6 publication discovery here.
- Bind the actual `args.root` checkout, workspace run, and selected destination before asynchronous HTTP work. Retain cursor in the bound workspace run; each write receives its own receipt run and conditional revision.
- Local manifest is an optional export, not authority. The production CLI must work with `.context` exports absent.

## Implemented paths

- `skills/b-memory-import/scripts/import-context-memory.ts`
  - `listMemoryMarkdown` now parses publication-proven revision bytes supplied by the service; removed the local walker and file-hash intersection helper.
  - `runImport` resolves `args.root` with `resolveConsumerContext` and uses `withBoundStore` to read both source revisions and `audit / memory-import / manifest.json` in the stable checkout/workspace run.
  - `loadManifest` reads only that retained artifact; corrupt retained JSON refuses instead of authorizing a local fallback.
  - `saveManifest(path, manifest, cwd, binding?)` awaits a conditional consumer batch against the pre-HTTP destination. Artifact identity uses `context.runId`; every cursor write uses a fresh, separate receipt run. Existing links are preserved by the shared batch seam.
  - The manifest export is written only after retention; no code reads it as skip authority. Removed the CLI's local-directory prerequisite.
- `skills/b-memory-import/scripts/import-context-memory.storage.test.ts`: 23 real-store importer regressions (all four adapters), local HTTP Hindsight-shaped endpoint, trusted publication-proof seam only.
- `skills/b-memory-import/scripts/import-context-memory.test.ts`: 24 Bun parser/planning tests; replaced obsolete filesystem-walker cases with adapter-revision/source-dir/frontmatter boundaries.

## Shared seams / requests

1. No shared-helper code change is required by this repair. It consumes the existing `resolveConsumerContext` → `resolveTrustedContext`, `withBoundStore`, `readConsumer`, and conditional/link-preserving `commitConsumerBatch` seams.
2. Current `resolveTrustedContext` supplies an empty `publishedRevisionIds` array. The importer deliberately refuses unproven publication. Positive import tests supply only trusted publication proof at the context seam; service configuration, checkout identities, persistence, receipts, and HTTP are real. Phase 6 owns publication discovery; this repair does not add it.
3. Documentation owner: update `skills/b-memory-import/SKILL.md` scan/skip/manifest descriptions. They still describe local files and a local skip manifest as authority. This file is outside the assigned edit scope.

## Evidence

### Focused regressions

Disposable database: `pgvector/pgvector:pg18`, container `buck-importer-r1r2-20261015`, `127.0.0.1:56453`, database `importer_repair`; not an application/user database.

```sh
BUCK_WORKFLOW_TEST_DATABASE_URL=postgres://postgres:importer-only@127.0.0.1:56453/importer_repair \
  npx vitest run \
  skills/b-memory-import/scripts/import-context-memory.storage.test.ts \
  skills/_shared/scripts/consumer-persist.test.ts
bun test skills/b-memory-import/scripts/import-context-memory.test.ts
```

Latest current-tree run: **36/36 Vitest passed** (23 importer + 13 shared-consumer tests; 2 files; no PostgreSQL skips), **24/24 Bun passed** (57 assertions). This was rerun after the repository-wide check and concurrent shared-seam changes.

Importer coverage:
- For repo-files, external-files, SQLite, and PostgreSQL: two exact published memory/backlog inputs import from adapter bytes with `.context` removed; private draft, index, and out-of-source backlog remain excluded. Removing source and manifest exports before restart produces `scanned:2, imported:0, skipped_unchanged:2`; cursor revision stays unchanged.
- On every adapter, valid local exports do not rescue real selected-store outages (repo manifest path replaced by a file; external ancestor replaced by a file; SQLite database replaced by a directory; PostgreSQL endpoint refused).
- On every adapter, changing configured destination during the HTTP request still retains the cursor at the pre-request destination. Restart refuses `Consumer destination changed during the bound workspace run`; no redirected store is created.
- On every adapter, successive manifest writes retain stable workspace artifact scope, preserve links and prior revision bytes, and leave an existing completed workspace receipt unchanged.
- Real same-branch Git worktrees: targeting checkout B while process cwd is elsewhere retains only B's cursor; A subsequently imports independently and B resumes with its own cursor.
- Corrupt authoritative cursor refuses before HTTP; a competing cursor advance during HTTP causes the stale importer write to refuse rather than overwrite it.

### Failing-before / mutation evidence

- Before importer edits: the initial 16-case storage suite exited 1, **12 failed / 4 passed**; adapter-only positive imports returned `scanned:0, imported:0`, and corrupt/stale cursor cases incorrectly resolved.
- After the fix, temporarily disabling the publication filter and omitting the bound conditional cursor write made the targeted suite exit 1, **5 failed / 18 deliberately unselected**. All four source cases leaked the draft (`scanned:3, imported:3` instead of 2); the concurrent cursor case resolved instead of refusing. Restored both lines, then reran the full focused commands above successfully.
- A subsequent shared file-store change made `list()` seal direct user edits as new unpublished revisions. One new test's post-edit `skipped_unchanged:2` assertion consequently failed with 1; this was an incidental scan-count assumption, not an importer fallback. The test now requires the actual invariants: no additional HTTP import and no retained cursor revision change despite the edited Markdown and fake local manifest. The strict two-input/two-skip assertions for **exports-absent restart** remain unchanged. No adapter-specific exception, relaxed timeout, ignored test, or guardrail change was added.

### Actual Bun runtime smoke

Command: `bun /tmp/importer-r1r2-runtime-smoke.ts` — **exit 0**. Throwaway script exercised the production `saveManifest`, actual configured stores, and fresh subprocesses running the production importer CLI from this checkout with `--root <fixture>/checkout-B --dry-run`. Removed fixture exports before each CLI restart; read back exact retained cursor bytes/key/revision afterward; then faulted the real adapter while valid local exports existed and reran that CLI.

Outage-smoke fixture base: `/tmp/.ctx-mode-5ht9y3/importer-r1r2-runtime-NOreo2/` (each adapter used `<base>/<adapter>/checkout-B`; disposable fixtures removed).

| Adapter | Stable workspace run | Exact cursor revision | Restart CLI | Outage CLI |
|---|---|---|---|---|
| repo-files | `run-56bebf4b-b754-48e9-9fb7-d1cdb4d59196` | `2933b59d-18b6-4991-bbc6-94d64b4c3f69` | exit 0 | exit 1, `EEXIST` |
| external-files | `run-d439d9d9-944f-4022-9866-1bf05e7617ff` | `7a03894f-b474-47a5-b527-98c872ceb176` | exit 0 | exit 1, `ENOTDIR` |
| SQLite | `run-1bda471f-c532-4970-b2fc-5a6f10acb3c6` | `290c628f-7b8d-48d4-89be-2bcc397cad24` | exit 0 | exit 1, `unable to open database file` |
| PostgreSQL | `run-16929442-d658-4d3b-9582-f405553f35aa` | `1fe27d2e-c49b-487c-b47b-b726d1c2c331` | exit 0 | exit 1, `ECONNREFUSED 127.0.0.1:1` |

Every key was `audit / memory-import / manifest.json` with the actual checkout's worktree ID and the stable workspace run above, not the manifest directory's identity. Repeated cursor writes returned that same workspace run and exact latest manifest bytes survived source/manifest export removal.

Runtime publication boundary: the production resolver supplies no publication proof yet, so actual CLI smokes intentionally report `scanned:0, imported:0`. The positive two-input HTTP import and published-only enforcement are exercised through the real `runImport` pipeline in the 23-case suite with trusted proof supplied at the existing context seam. No live remote Hindsight or Phase-6 publication discovery is claimed.

Current-tree repeat: `bun /tmp/importer-r1r2-final-smoke.ts` — **exit 0**. All four actual Bun CLI subprocesses again exited 0 with `.context` removed, exact cursor readback, and repeated-write workspace stability after the shared file-store update. Fixture base `/tmp/.ctx-mode-VuoaS9/importer-final-smoke-vwd1sv/`, suffix `<adapter>/checkout-B`; fixtures removed.

| Adapter | Workspace run | Exact cursor revision |
|---|---|---|
| repo-files | `run-f243f9cb-32fe-49f8-acca-16eb854248db` | `77e7ff94-6dea-43e1-92f2-ae290ea0b8b8` |
| external-files | `run-5faa81bb-1fe4-4b59-a89b-e1dc4df8364f` | `392d9d8d-2758-42d6-a9b0-ebc256cd1687` |
| SQLite | `run-efd543d6-4322-4787-a62f-9674d7f91f89` | `e9a7ba3a-2b99-418d-99b4-1530dfb00ca9` |
| PostgreSQL | `run-5ad1297c-6f2e-4c36-a733-5e860fe95bc1` | `66db9c0d-7d4d-47f5-a615-d018972cb3ca` |


`xd://lsp` diagnostics: importer source and new storage regression file both returned `OK`.

### Deterministic contract

`guardrails.json` remains unchanged. The first `npm run guardrails:check` request exceeded the context-mode MCP transport's 30-second limit despite `timeout:1800000`; outcome was not delivered. Reported the tool issue. A recoverable background run using `/tmp/importer-r1r2-guardrails-capture.mjs` then completed the unchanged command:

- Exit **1**, durable v2 verdict **fail**.
- `unit_test_gate:fail` (`unit_exit_code:1`), `global_ratchet:fail`, `complexity_gate:fail`.
- `functional_test_gate:skipped`, `lint_gate:skipped`, `patch_gate:advisory`.
- Coverage: `current:null`, `baseline:84`; diagnostic `coverage command failed (exit 1)`.
- **No importer entries** in either `complexity.new_violations` or `complexity.hard_ceiling_violations`.
- Unit failure tail names `skills/code-review/scripts/pr-context.test.ts` → repo-files pinned SHA restore (`restoreSummary:183`, called at `:270`): `pr-context: no retained pinned evidence for pull/octo/hello/pr-42/`.
- Unhandled rejection tail names `extensions/buck-loop/__tests__/run-step.test.ts` → productive-session idle-timeout case, with `ENOENT .../repo-manifest/.lock` through `skills/_shared/storage/file-store.ts:511` and `extensions/buck-loop/sql-save.ts:217,75,74`.
- New complexity findings name `extensions/buck-loop/{__tests__/loop.test.ts,index.ts,loop.ts,sql-save.ts}`, `extensions/token-attribution/{db.ts,report.ts}`, `skills/b-save-improved/scripts/{save-apply.ts,save-preflight.ts}`, and `skills/code-review/scripts/pr-context.ts`.
- Hard-ceiling findings: `extensions/buck-loop/sql-save.ts::prepareSaveAttempt=26`; `skills/b-save-improved/scripts/save-apply.ts::(anonymous)=18,runApply=18`; `skills/b-save-improved/scripts/save-preflight.ts::(anonymous)=98`.

These paths are outside importer ownership. Integration owner must resolve/recheck R9 on the combined tree; this note does **not** claim a passing repository gate or close the Phase-5 iteration. The subsequent importer-only verification is green as recorded above.

## Assigned acceptance evidence

- **R1 importer source/cursor authority, four adapters, exports absent:** the 23-case importer suite exercises actual `runImport` with real configured stores and exact trusted publication proof; all four fresh Bun CLI restart/readback smokes pass. No file union, missing-row fallback, or outage fallback remains.
- **R2 actual checkout and pinned destination:** same-branch Git worktree A/B case and per-adapter mid-HTTP config-change cases pass; cursor keys use the actual target root's stable worktree/run, and restart refuses a changed destination.
- **Published-only and retention contracts:** unpublished source bytes are withheld; stale cursor writes refuse; repeated cursor writes preserve links and stable artifact scope without reusing a completed workspace receipt. Production missing-publication proof continues withholding.
- **Ownership:** only importer source/tests and this requested evidence artifact were edited. No shared-helper edits, actual-repository staging/commits, loop state, or iteration-status changes. Temporary Git commits were confined to disposable test/smoke fixture repositories. Disposable smoke scripts and isolated database are removed after verification.
