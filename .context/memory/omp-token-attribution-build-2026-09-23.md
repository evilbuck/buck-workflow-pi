---
date: 2026-09-23
domains: [extensions, testing, tooling]
topics: [omp, token-attribution, sqlite, git-worktrees, token-report, delivery-reconciliation]
related: [.context/2026-09-23.omp-token-attribution/plan-omp-token-attribution.md, .context/2026-09-23.omp-token-attribution/iterate-omp-token-attribution.md]
priority: high
status: completed
subject: 2026-09-23.omp-token-attribution
artifacts:
  - plan-omp-token-attribution.md
  - iterate-omp-token-attribution.md
---

# OMP token attribution build

## Outcome

Implemented the assigned non-phased plan, completed the review iteration, and passed independent re-review. The OMP extension records assistant and nested-session usage into a plugin-owned table in `~/.omp/stats.db`, attributes rows to origin/common-dir plus branch, and registers `/tokens` (or `/token-use` on collision) for estimated project and branch totals. Runtime-only command discovery is deferred until `session_start`, so OMP can load the extension.

The iteration corrected nested delivery identity: an event-time fallback row is atomically reconciled to the persisted JSONL entry ID, while uniqueness remains exclusively `(session_file, entry_key)`. This prevents one child turn from being counted twice without conflating legitimate entries that share timestamp, provider, model, and token count. Living documentation now covers the extension data flow and attribution semantics; `docs/howto/inspect-project-token-use.md` covers the user-facing command.

## Decisions

- Use `node:sqlite` through lazy `createRequire`, which works under OMP's Bun runtime and avoids breaking package import on older Node runtimes before the feature is exercised.
- Preserve only the required `(session_file, entry_key)` uniqueness. Drop the obsolete semantic unique index on database open so existing development databases adopt the corrected contract.
- During nested scanning, use the assistant-message timestamp to derive the same fallback key as the live event. In one immediate transaction, upgrade that fallback key to the persisted entry ID; if the persisted ID already exists, remove the stale fallback instead.
- Store `cost_source = usage` when `usage.cost.total` exists; this covers normalized OMP usage without claiming which upstream pricing source supplied it.
- Restore the latest custom identity entry on `session_start`, preventing duplicate identity entries after extension reload.
- Cache project identity by cwd and branch/detached-HEAD state, while probing HEAD state at each turn boundary so branch attribution remains current.
- Scan nested JSONL asynchronously from per-file byte cursors. Keep incomplete trailing bytes until the next scan rather than reparsing historical transcript content.

## Files Modified

- `extensions/index.ts`
- `extensions/token-attribution/index.ts`
- `extensions/token-attribution/git-identity.ts`
- `extensions/token-attribution/db.ts`
- `extensions/token-attribution/report.ts`
- `extensions/token-attribution/__tests__/db.test.ts`
- `extensions/token-attribution/__tests__/git-identity.test.ts`
- `extensions/token-attribution/__tests__/ingest.test.ts`
- `extensions/token-attribution/__tests__/report.test.ts`
- `extensions/token-attribution/__tests__/wire.test.ts`
- `.context/2026-09-23.omp-token-attribution/iterate-omp-token-attribution.md`
- `.context/2026-09-23.omp-token-attribution/draft-commit.md`
- `.context/memory/omp-token-attribution-build-2026-09-23.md`

## Verification

- RED evidence came from independent review: one 15-token child turn was reproduced as 30 tokens when live and persisted timestamps differed; two legitimate IDs with identical semantic fields collided.
- Focused iteration suite: `npx vitest run extensions/token-attribution` — 5 files, 16 tests passed. Regressions cover differing outer/message timestamps, fallback-to-entry-ID reconciliation, and retention of distinct entry IDs.
- Light deterministic contract: `npx vitest run` — 62 files, 951 tests passed. Lint is disabled in `guardrails.json`.
- Earlier build smoke: a temporary git repository on `feature/smoke` resolved its origin and inserted 20 fake tokens into a temporary SQLite database.
- Earlier live OMP smoke: `omp -p --no-tools --thinking=off --max-time=90 "Reply exactly TOKEN-ATTRIBUTION-SMOKE"` returned the requested text; SQLite contained this repository's origin, active branch, provider/model, and 35,006 tokens.
- Independent re-review: Pass with warnings; no in-plan or out-of-plan defects. The only warning was optional future `session_shutdown` database cleanup.
- Fresh review guardrails: durable contract passed; unit, patch, global ratchet, and complexity gates passed; coverage 85.8% against the 84% baseline.

## Abandoned Approaches

- Semantic uniqueness on `(session_file, recorded_at, provider, model, total_tokens)`: discarded because event and persisted timestamps differ for one delivery, while separate deliveries can legitimately share every field in that tuple.

## Closeout

Implementation, iteration, independent review, living documentation, how-to, backlog archival, and `/b-save` are complete. `/b-commit` remains supervisor-owned. Subject lifecycle remains active because `close-verified` intentionally refuses unphased plans.
