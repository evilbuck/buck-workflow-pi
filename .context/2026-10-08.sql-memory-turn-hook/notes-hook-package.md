---
date: 2026-10-08
domains: [extensions, hooks]
topics: [turn-memory, package-hook, pg]
related: [phase-3-hook-package.md]
priority: high
status: active
subject: 2026-10-08.sql-memory-turn-hook
---

# Phase 3 hook notes

The hook registers `session_start` and `agent_end` only. It never calls `sendUserMessage` or `sendMessage`. Installed `AgentEndEvent` has `messages` and no source field, so an extension-triggered `agent_end` counts. A runtime `willContinue: true` does not tick.

`pg` is imported only inside the remember path after enablement. Factory load with `SQL_MEMORY_URL` unset does not add `pg` to `require.cache`.

Jev `jev-1.13.0`: criterion_1 0.92, criterion_2 0.87, criterion_3 0.53. The third box stays open because this running OMP process was started before `hooks/post/turn-memory.ts` existed, so `/extensions` was not observed. Package surface evidence: `package.json` `files` includes `hooks`, `hooks/post` contains only `turn-memory.ts`, and `extensions/index.ts` does not name it.

Live writer proof, injected judgment, real `rememberSqlMemory`: three prompts returned existing active id `01a11e8a-3a45-74d4-a076-34b247569f16`, a fourth prompt did not write, and `BUCK_TURN_MEMORY=0` wrote none. The first overlapping fourth-prompt write was a sliding-window bug; consumed tick identities are now excluded.
