---
date: 2026-10-08
domains: [docs, sql-memory]
topics: [turn-memory, opt-out, live-proof]
related: [phase-4-docs-proof.md]
priority: medium
status: active
subject: 2026-10-08.sql-memory-turn-hook
---

# Phase 4 proof

Docs: `docs/sql-memory.md` keeps ordinary `remember` and `/b-save` ungated. `docs/howto/toggle-turn-memory.md` is the off switch. Jev `jev-1.13.0` scored those two criteria 0.94 and 0.95.

Live SQL proof used the real `rememberSqlMemory` writer with an injected 0.91 judgment. Three prompts returned active id `01a11e8a-3a45-74d4-a076-34b247569f16`. A fourth prompt did not write. `BUCK_TURN_MEMORY=0` wrote none. This was not a live Jev extraction; the judgment was injected.

`/extensions` was not observed in this already-running OMP process. Restart OMP and confirm `hooks/post/turn-memory.ts` is listed once before treating that phase 3 box as closed.
