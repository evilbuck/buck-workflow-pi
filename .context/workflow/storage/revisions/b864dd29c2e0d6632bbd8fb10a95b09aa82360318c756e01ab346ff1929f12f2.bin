## Phase 1 Review: Needs work

The adapter is registered and the fetcher tests pass, but two **in-plan output-handling defects** prevent Phase 1 from passing.

| Deliverable | Status | Evidence |
|---|---|---|
| Register `fix_pr_feedback` | ✅ Complete | `extensions/fix-pr-feedback/index.ts:210-232`; wired in `extensions/index.ts:28` |
| Private seen-ID file and cleanup | ✅ Complete on tested paths | `index.ts:180-207`; cancellation and failure tests |
| Bounded, fail-closed child output | 🔄 Partial | Oversized stdout kills the child but can wait indefinitely for `close` |
| Preserve compact candidate metadata | 🔄 Partial | Splitting a UTF-8 character across stdout chunks corrupts `pathLine` |
| Focused verification | 🔄 Partial | 29 tests pass, but neither defect has a regression test |

**Review axes:** Spec-axis worst finding: oversized output can leave the invocation pending and its temporary files in place. Standards-axis worst finding, from a separate sequential pass: per-chunk UTF-8 decoding corrupts non-ASCII paths. No cross-axis ranking.

**Direct reproduction:** An oversized fake-child stream remained pending until explicitly aborted. A summary containing `src/café.ts:2`, split within `é`, returned `src/caf��.ts:2`.

**Guardrails:** Durable v2 **pass**. Unit, patch, coverage ratchet, and complexity passed; lint and functional gates were skipped/disabled.

Both findings are in-plan. The proposed repairs and regression cases are in the **staged** artifact `.context/2026-09-28.fix-pr-native-pr-tool/iterate-tool-contract-adapter-fifth-review.md`. No out-of-plan finding or immediate how-to impact; the planned later documentation phase remains unchanged.

**Supervisor handoff:** `/b-iterate` on that artifact, then re-review this phase. No loop state was selected.
