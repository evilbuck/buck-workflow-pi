---
status: completed
date: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [review, fix-pr, agent-tool]
related: [phase-1-tool-contract-adapter.md]
---

# Phase 1 review: Tool contract and adapter

## Plan source and baseline

- Contract: `phase-1-tool-contract-adapter.md` (Phase 1 only); user goal: expose complete fix-pr feedback through an agent tool backed by the canonical CLI.
- Baseline: `17bb0c3` plus the current staged and unstaged tree. This long-lived tree includes staged fetcher migration and unrelated unstaged skill edits; this review attributes only Phase 1 adapter, wiring, and inventory changes.
- Current session state has no active `goal` field.

## Completion matrix

| Deliverable | Status | Current-state evidence |
| --- | --- | --- |
| Typed tool registration and wiring | Complete | `extensions/fix-pr-feedback/index.ts:29-33,287-310`; `extensions/index.ts:12,28`. |
| Explicit repo/positive PR; private seen-ID file with cleanup | Complete | `extensions/fix-pr-feedback/index.ts:29-33,233-253,276-284`; `extensions/fix-pr-feedback/__tests__/index.test.ts:48-112,114-126,477-492`. |
| Bun without shell; bounded safe progress; compact response | Complete | `extensions/fix-pr-feedback/index.ts:97-132,156-184,205-230,254-270`; regression at `extensions/fix-pr-feedback/__tests__/index.test.ts:354-405`. |
| Failure, invalid output and cancellation fail closed | Complete | `extensions/fix-pr-feedback/index.ts:186-230,256-284`; regressions at `extensions/fix-pr-feedback/__tests__/index.test.ts:128-317,320-352,407-475`. |
| Private collision-free inventory; canonical CLI schema | Complete | `skills/fix-pr/scripts/fetch-feedback.ts:806-810,841-900` creates a unique mode-0700 directory and mode-0600 inventory; adapter accepts its compact summary. |
| Fixture verification | Complete | `bunx vitest run extensions/fix-pr-feedback/__tests__/index.test.ts skills/fix-pr/scripts/fetch-feedback.test.ts`: 37 tests passed. |

## Review axes

- Spec axis worst finding: none. The adapter delegates exhaustive ingest to the existing CLI; no review/CI body parsing is duplicated. No out-of-scope change attributed to Phase 1.
- Standards axis worst finding: none. Sequential fallback pass (no background task tool available), independently scoped to the TypeScript and universal quality guides plus the long-method and duplicate-code catalog entries. The adapter separates process collection, validation and registration; the intentionally mirrored Codex fetcher is packaging parity, not a second ingest implementation.
- No cross-axis ranking.

## Verification and verdict

- Real child smoke: `feedbackTool().execute` launched the bundled Bun CLI without GitHub access using PR number `0`; it returned `{ "error": true, "code": "fetch_failed", "message": "fix_pr_feedback exited 2" }` without inventory.
- Durable guardrails: pass, contract v2; unit pass, functional skipped (disabled), lint skipped (disabled), patch pass (advisory), global ratchet pass (88% versus 84%), complexity pass.
- Goal: Phase 1 met. Live PR/tool equivalence and skill/docs cutover belong to later phases, not this verdict.
- Documentation impact: new tool surface and workflow need living docs in planned Phase 3; non-blocking here. How-to impact: no separate user-facing procedure added by this adapter alone.
- In-plan issues: none. Out-of-plan issues: none.
- Verdict: **Pass**. Supervisor owns subsequent phase and loop-state selection. Later phase work, documentation and final save/commit remain outside this assigned review.
