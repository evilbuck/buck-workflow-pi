---
date: 2026-10-08
domains: [extensions, testing]
topics: [turn-memory, capture, remember]
related: [phase-2-capture-write.md]
priority: high
status: active
subject: 2026-10-08.sql-memory-turn-hook
---

# Phase 2 capture closeout

Selected course: injected Jev, extraction, and remember. No new SQL client and no source-key reimplementation. Per-call deadlines default to 8 seconds so judge, extract, and write stay inside the 30-second hook budget.

Evidence: `npx vitest run extensions/turn-memory/__tests__/capture.test.ts` passed 8 tests. Jev `jev-1.13.0` scored criterion_1 0.93, criterion_2 0.92 after the boundary and failure tests, criterion_3 0.93.

Assumptions: A-4 remains validated by the hung-extract and hung-remember tests. A-5 and A-6 stay with phase 3.

Material risk: a timeout after a write starts is absorbed by `rememberSqlMemory` idempotence on subject, phase, and body. This module does not retry the writer itself.

Excluded: hook registration, package files, and docs.
