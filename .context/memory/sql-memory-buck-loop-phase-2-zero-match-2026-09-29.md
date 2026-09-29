---
date: 2026-09-29
domains: [extensions, sql-memory, testing]
topics: [buck-loop, bounded-recall, empty-results, jev]
related: [../2026-09-28.sql-memory-buck-loop/phase-2-recall-bounded-judgment.md, sql-memory-buck-loop-phase-2-runtime-2026-09-29.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-2-recall-bounded-judgment.md, ../../extensions/buck-loop/__tests__/project-memory.test.ts]
---

# SQL memory Buck-loop Phase 2 zero-match contract

## Result

Closed the diagnosed test gap: a successful shared SQL query with zero active project matches is asserted as an empty result, distinct from missing SQL configuration and SQL query failure. The focused project-memory contract suite passes 5/5, including identity/provenance, active bounded recall, legal Jev shortlist/failure behavior, SQL error distinction, and common-git-dir fallback.

Follow-up run (same date) closed the counterpart gap: the prior "zero active matches" live check ran against a completely empty store (no users, projects, or memories), so no row had ever flowed through recall. Seeded the store with one user (`buckleyrobinson@gmail.com`), the project row (`git@github.com:evilbuck/buck-workflow-pi.git`), and two active memories carrying `main`-branch provenance (`298c503bb9…`), then ran the production `recallProjectMemories()` live: `success-rows` returned both rows with ID/body/category/project/branch/SHA while the current branch was `feat/sql-memory-tool` — proving all-branch recall, provenance-only branch/SHA, and the full bounded shortlist path end to end. The two seeded memories remain active as genuine project memories (phase-2 recall contract; `plainto_tsquery` pitfall).

The phase-2 iterate artifact is completed: `plainto_tsquery` alignment (gate tests both directions), typed `RecallOutcome` with loop-level refusal to spawn a child on configured-recall failure, and per-candidate `noul` Jev filtering with deterministic fallback are all fixed and verified. The earlier Codex plugin parity gap is closed (byte-identical `_shared` copy; `b-howto` is not shipped in the plugin bundle, so four of five skills carry the reference there). The live nested-OMP-child proof remains outside this environment's reach (no OMP child runtime exposed); the loop-level regression tests cover the spawn/no-spawn contract.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/project-memory.test.ts extensions/sql-memory/sql-gate.test.ts extensions/buck-loop/__tests__/loop.test.ts`: 98/98 passed.
- Live: `recallProjectMemories()` via tsx against `SQL_MEMORY_URL` returned `success-rows` with correct identity and both seeded rows.
- `npm run guardrails:check`: `status: pass`, `contract: durable`, v2; unit/patch/global-ratchet/complexity gates pass (functional/lint disabled). Coverage 88.5 vs baseline 84 (ratchet raise proposed, not applied by this nested run).
- Live nested-OMP proof: not exercised; no OMP child runtime in this execution interface (regression tests cover the contract).

## Files changed by this continuation

- `extensions/buck-loop/__tests__/project-memory.test.ts` (existing assignment test, verified again).
- `.context/memory/sql-memory-buck-loop-phase-2-zero-match-2026-09-29.md` (this checkpoint).
