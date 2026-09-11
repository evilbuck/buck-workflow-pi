---
date: 2026-09-10
domains: [extensions, testing, state-machine]
topics: [b-pr-manager, xstate, phase-1, verdicts, polling]
related: [b-pr-manager-plan-2026-09-10.md]
priority: high
status: completed
subject: 2026-09-10.b-pr-manager
artifacts:
  - extensions/b-pr-manager/types.ts
  - extensions/b-pr-manager/machine.ts
  - extensions/b-pr-manager/__tests__/machine.test.ts
  - extensions/b-pr-manager/__tests__/fixtures/gh-payloads.ts
  - .context/2026-09-10.b-pr-manager/phase-1-contracts-pure-machine.md
  - .context/2026-09-10.b-pr-manager/review-phase-1-contracts-pure-machine.md
---

# b-pr-manager Phase 1 — contracts and pure machine

Worktree `feat/agent-manage-pr` at `agent-manage-pr.wt`. Phase 1 built and reviewed Pass.

## Decisions
- Machine is event-driven XState v5 with no invoked actors; later phases send typed events after I/O.
- Waiting uses XState `after` delays from `DEFAULT_POLL_DELAYS_MS` (7 waits = 35m30s). Eighth no-progress `REMOTE_GATE_PENDING` exhausts.
- Root `CANCEL`/`BLOCK` apply to every active state. `merged` is terminal but not `type: final`, so stray cancel/block are ignored without stopping the actor.
- Verdicts copy fix-pr exactly: `valid | invalid | already_done | unsure | nit | out_of_scope`. Valid nits are actionable.
- Success is never claimed in this phase; `GITHUB_STATE_MERGED` is the only path into `merged`.
- Runtime state still belongs under `<git-dir>/b-pr-manager/` (persistence is Phase 4).
- No `extensions/b-pr-manager/index.ts` and no `extensions/index.ts` edit.

## Verification
- `npx vitest run extensions/b-pr-manager/__tests__/machine.test.ts` — 22 passed
- `npx vitest run extensions/b-pr-improved/__tests__/wire.test.ts` — 7 passed
- `uvx lizard -C 10` on phase files — max CCN 4
- Patch coverage of new files 96.55% (>=90)

## Next
Phase 2: extract shared PR git primitives (`phase-2-shared-pr-git.md`, hard, `/b-build-hard`).
