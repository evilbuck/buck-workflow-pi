## Phase 1 review: Needs work

The adapter is registered and launches the canonical CLI. Seen-ID rejection, private inventory paths, and cancellation cleanup have current-state evidence. Two **in-plan** output-boundary defects remain; neither is covered by the passing tests.

| Deliverable | Status | Evidence |
|---|---|---|
| Tool registration and CLI adapter | ✅ Complete | `extensions/index.ts:12,28`; `extensions/fix-pr-feedback/index.ts:182-204` |
| Seen IDs and resource cleanup | ✅ Complete | `index.ts:132-179`; focused tests passed |
| Private concurrent inventories | ✅ Complete | `skills/fix-pr/scripts/fetch-feedback.ts:858-864`; distinct-path test at `fetch-feedback.test.ts:467-478` |
| Bounded, payload-free results | 🔄 Partial | Nonzero exits return CLI stderr at `index.ts:167`; stdout and candidate fields remain unbounded at `index.ts:102-110,158` |

**Spec-axis worst finding:** A failed fetch can return untrusted PR title or CI signal text. The CLI writes both to stderr (`fetch-feedback.ts:758-761,823-824`), and the adapter copies stderr into its error result. This violates Phase 1’s no-raw-payload response boundary.

**Standards-axis worst finding:** Stdout is accumulated without a ceiling before JSON parsing; limiting the *number* of returned candidates does not bound memory or candidate-field length. This was a separate sequential pass using the TypeScript and diff-relevant quality guides; no background sub-agent tool was available. No cross-axis ranking was applied.

**Verification:** 23 focused tests passed. Durable guardrails v2 **passed**: unit, patch, ratchet, and complexity passed; lint and functional were skipped. Those checks do not cover either finding. This review is limited to Phase 1, not the later skill, docs, or live-PR phases. No additional documentation or how-to impact was identified.

Both fixes are recorded in the **staged, review-owned** `.context/2026-09-28.fix-pr-native-pr-tool/iterate-tool-contract-adapter-third-review.md`. No pre-existing files were staged by this assignment. Recommended route for the supervisor: `/b-iterate`, then re-review Phase 1.
