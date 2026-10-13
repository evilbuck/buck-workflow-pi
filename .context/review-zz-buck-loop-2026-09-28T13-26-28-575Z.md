## Phase 1 review: Needs work

The adapter is registered, invokes the canonical fetcher without a shell, uses a private seen-ID file, and bounds cancellation and output. Two in-plan failure boundaries remain:

| Axis | Worst finding |
|---|---|
| Acceptance contract | `compactSummary` accepts an empty `inventoryPath` and a missing `headRefOid` as a successful result (`extensions/fix-pr-feedback/index.ts:120-135`). Malformed successful output can therefore claim an unusable inventory. |
| Engineering standards (sequential pass; no background `task` tool available) | A failure from `rm` in `finally` rejects `execute` with a filesystem exception instead of a structured failure (`extensions/fix-pr-feedback/index.ts:215-217`). It can also leave private seen IDs behind. |

Both are Phase 1 defects; neither requires work from later phases. Fix proposals and regressions are recorded in the **staged** artifact `.context/2026-09-28.fix-pr-native-pr-tool/iterate-tool-contract-adapter-seventh-review.md`. No pre-existing files were staged for this assignment.

**Verification:** 31/31 focused adapter and fetcher tests passed. Durable guardrails v2 passed; unit, ratchet, complexity, and advisory patch gates passed, while lint and functional gates were skipped. A direct Bun invocation exercised the real adapter subprocess and returned structured `fetch_failed` for the CLI’s exit-2 validation path. Those checks do not cover the two findings.

**Documentation/how-to impact:** None for this review. The findings route to `/b-iterate`; the supervisor owns the next loop state.
