## Phase 1 Review: Needs work

The adapter is registered and the focused suites pass, but two in-plan output-boundary defects prevent a pass. The **spec axis** worst finding is cancellation during cleanup; the **standards axis** worst finding is raw feedback that can escape through count keys. The standards pass was sequential because no background `task` tool was available; the axes were not ranked against each other.

| Phase work | Status | Current-state evidence |
|---|---|---|
| Tool contract and registration | ✅ Complete | `extensions/fix-pr-feedback/index.ts:13-17,243-265`; `extensions/index.ts:12,28` |
| CLI adapter, cancellation, and output boundary | 🔄 Partial | Child execution and cleanup exist at `index.ts:194-240`, but an abort during the cleanup await can still return the earlier success inventory. `compactCounts` at `index.ts:95-103` also forwards arbitrary keys. |
| Concurrency-safe inventory | ✅ Complete | `skills/fix-pr/scripts/fetch-feedback.ts:858-863` creates a unique private directory and inventory. |
| Phase tests | 🔄 Partial | 34/34 focused tests pass; neither abort-during-cleanup nor raw-content count keys are covered. |

A further warning: `index.ts:232-234` returns setup exception messages verbatim, potentially exposing the private seen-ID path.

**Verification:** A direct Bun tool invocation reached the canonical CLI and returned structured `fetch_failed` for an invalid PR number. Durable v2 guardrails passed: unit, ratchet, complexity, and advisory patch gates; lint and functional gates were skipped. This review did not establish a live OMP-tool or GitHub-fetch result.

The in-plan findings and proposed regressions are recorded in the **staged** `.context/2026-09-28.fix-pr-native-pr-tool/iterate-tool-contract-adapter-eighth-review.md`. No out-of-plan issue, documentation impact, or how-to impact was identified for this phase. The next implementation step is `/b-iterate`; loop-state selection remains with the supervisor.
