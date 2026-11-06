## Phase 7 Review: Needs work

**Seven in-plan defects; no out-of-plan findings.** The implementation adds isolated helpers, but does not deliver an operational data cutover.

Baseline: `2adebce` plus the staged/unstaged Phase 7 changes present at review start.

### Completion Matrix

| Acceptance criterion | Status | Finding |
|---|---|---|
| Exact scoped export/import | Partial | Current artifacts round-trip; historical revisions, corrections, receipts, publication evidence, and legacy rank metadata are not preserved by that route. File export can mutate the source through reconciliation. |
| Explicit legacy quarantine | Missing | `splitLegacy()` returns arrays, not a durable recovery scope; validation accepts records without checkpoint evidence. |
| Full dry-run and atomic switch | Missing | Dry-run omits destination-only records and metadata differences. No backend config-switch operation exists. |
| Interrupted import recovery | Missing | Cursor advances before writes; no persisted attempt, restart fixture, or partial-visibility protection. |
| Post-cutover rescue and rollback | Missing | `rollbackPlan()` returns ID arrays; it does not rescue data, restore a verified snapshot, or switch configuration. |
| Legacy doctor and protocol cutover | Partial | Helpers have no production callers. Actual CLI invocation fails instead of diagnosing legacy configuration. |
| Credential-safe output | Partial | Redaction misses JSON passwords and is not integrated into operator output. |

### Independent Review Axes

- **Spec axis worst finding:** no executable atomic switch or rollback—Phase 7’s central deliverable is absent.
- **Standards axis worst finding:** credential redaction leaves serialized JSON values unchanged. Standards ran as a separate sequential fallback pass; no sub-agent tool was available.
- No cross-axis ranking.

### Verification

- Cutover suite: **3/3 tests passed**, covering only the narrow round-trip/helper cases.
- Direct execution reproduced omitted destination records, ignored link differences, premature cursor advancement, insufficient provenance checks, and JSON redaction failure.
- Actual doctor command: **exit 1**, `doctor requires --subject`.
- **Guardrails: pass**, durable v2. Unit, global-ratchet, and complexity gates passed; functional/lint skipped; patch advisory. Coverage **88%**, baseline **84%**.

Documentation/how-to impact is flagged, non-blocking, after operational behavior exists.

**Written and staged only:**  
`.context/2026-10-10.durable-storage-adapters/iterate-phase-7-data-cutover-review.md`

The artifact contains evidence, fixes, and the full completion matrix. Existing implementation changes were preserved; phase and loop state were not changed. Recommended follow-up: `/b-iterate` against this artifact, then re-review the same phase.
