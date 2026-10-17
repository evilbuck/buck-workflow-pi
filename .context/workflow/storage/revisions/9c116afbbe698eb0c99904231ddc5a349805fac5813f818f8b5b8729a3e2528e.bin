---
status: completed
date: 2026-09-23
updated: 2026-09-23
subject: 2026-09-23.omp-token-attribution
topics: [review, iteration]
informs: []
addresses: plan-omp-token-attribution.md
completed: 2026-09-23
from_review: b-review
---

# Iteration: OMP token attribution

## Source
- Reviewed after: `/b-iterate`
- Plan: `plan-omp-token-attribution.md`
- Spec: none

## Critical Issues

### 1. Delivery deduplication both double-counted and dropped valid turns
- **Files**: `extensions/token-attribution/index.ts`, `extensions/token-attribution/db.ts`, `extensions/token-attribution/__tests__/db.test.ts`, `extensions/token-attribution/__tests__/ingest.test.ts`
- **Resolution**: Removed the semantic delivery unique index. The database now preserves the required `(session_file, entry_key)` uniqueness only. Nested JSONL ingestion atomically upgrades an event-time fallback key to the persisted entry ID before attempting insertion, or removes the fallback when the persisted ID already exists.
- **Regression coverage**: The ingest regression uses different outer-entry and assistant-message timestamps and confirms one stored row after live-child then parent-scan delivery. The database regression confirms two distinct entry IDs with otherwise identical fields both remain countable, including cleanup of the obsolete semantic index.

## Warnings

None.

## Verification

- `npx vitest run extensions/token-attribution` — 5 files, 16 tests passed.
- `npx vitest run` — 62 files, 951 tests passed.
- Lint gate is disabled by `guardrails.json`; no lint command ran.

## Next Step

Re-run `/b-review` against `plan-omp-token-attribution.md`.
