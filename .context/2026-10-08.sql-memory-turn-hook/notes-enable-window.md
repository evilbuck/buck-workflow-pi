---
date: 2026-10-08
domains: [extensions, testing]
topics: [turn-memory, enablement, replay-safe-window]
related: [phase-1-enable-window.md, plan-sql-memory-turn-hook.md]
priority: medium
status: active
subject: 2026-10-08.sql-memory-turn-hook
artifacts: [extensions/turn-memory/enable.ts, extensions/turn-memory/window.ts, extensions/turn-memory/__tests__/enable.test.ts, extensions/turn-memory/__tests__/window.test.ts]
---

# Phase 1 implementation checkpoint

Implemented pure opt-out resolution and persisted-entry window selection with bearer, SQL URL, and key-assignment redaction. The window uses the latest three unique completed prompt markers, ignores continuation markers, excludes arbitrary tool-result entries, caps text, and skips a consumed window id.

Focused test run: `npx vitest run extensions/turn-memory/__tests__/enable.test.ts extensions/turn-memory/__tests__/window.test.ts` passed (9 tests) after adding the global-settings opt-out case. Acceptance wrap-up Jev `jev-1.13.0`: criterion_1 noul 0.93, criterion_2 noul 0.90. Both boxes checked.
