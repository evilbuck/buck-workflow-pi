## Plan Path Review: Phase 2 — Jev Ranking Core

**Verdict: Needs work.** Three in-plan defects reproduced. The 129 ranking tests pass, but the required deterministic contract fails.

### Plan Source
- File: `.context/2026-10-03.review-severity-ranking/phase-2-jev-ranking-core.md`
- Goal: Deliver the callable ranking core, retry policy, audit, and iterate-artifact rewrite—not loop integration.
- Baseline: `8f8c51132e8b77173d31d1ee664359ae87952635` plus the staged Phase 2 implementation.

### Evidence Sources
- Reviewed `extensions/buck-loop/ranking.ts` and `extensions/buck-loop/__tests__/ranking.test.ts`.
- Pre-existing changes: both implementation files staged; phase metadata staged/unstaged; phase overview unstaged.
- Ran the ranking tests and deterministic guardrails.
- Exercised `rankIssues()` with real temporary filesystem reads/writes and injected judgment responses, including the native `runJev`/evaluator adapter. **No live Jev call.**
- Left all pre-existing changes untouched.

### Completion Matrix

| Deliverable | Status | Evidence |
|---|---|---|
| Five named questions; bounded issue context; native Jev adapter | Complete | `ranking.ts:174,190–193,237–244`; native-adapter smoke accepted the request and filtered mixed findings. |
| Missing or oversized source context becomes a Jev failure | Partial | Named missing/oversized files are covered; an omitted `File` bullet silently becomes below-waterline (`ranking.ts:182–187`). |
| Thrown or missing-required-answer failures retry once | Complete | `ranking.ts:188–205`; retry-success and exhaustion smoke each observed two calls. No chat fallback exists in the module. |
| Second failure keeps the issue above-waterline; first failure is noted | Partial | Exhaustion routes above-waterline, but successful retry discards failure history and retained iterate issues receive no failure/re-review annotation. |
| Missing Q5 does not retry or bump | Complete | Passing test at `ranking.test.ts:260–277`. |
| Audit records findings before rewriting; audit failure blocks | Complete | `ranking.ts:224–232`; smoke observed one failed audit-write attempt and no rewrite. |
| Rewrite retains exactly the above-waterline findings | Partial | Ordinary mixed findings filter correctly. Padded heading numbers lose an above-waterline finding; duplicate numbers retain a below-waterline finding. |
| Empty above-waterline set uses `below-waterline`, not `completed` | Complete | Passing test at `ranking.test.ts:260–277`; filesystem smoke observed the status change. |
| A-5/A-8 validation | Partial | Retry/exhaustion behavior exercised. Failure-note requirements fail; the planned two-issue, one-missing-answer isolation test is absent. |
| R-3/R-4 controls | Partial | Audit ordering and native-only calling verified; R-3’s exact-retention invariant fails on accepted heading inputs. |
| Deterministic verification | Missing | Durable guardrails returned `fail`. |

### Review Axes

**Spec axis — worst finding: omitted File metadata silently skips a finding.**

At `ranking.ts:182–187`, the parser-accepted `file: ""` input produces no failure because the failure initializer requires a truthy filename. Smoke observed:
- Zero judge calls.
- `above: false`.
- No Jev-failure note.
- Artifact changed to `status: below-waterline`.

This contradicts the required missing-context failure policy.

A second spec defect occurs at `ranking.ts:197–215,319–355`: retry recovery erases the first-failure history; exhausted retries record it only in the audit, not on the retained issue.

**Standards axis — worst finding: inconsistent issue identity causes lost or incorrectly retained findings.**

Sequential fallback pass, seeded with the TypeScript/universal-quality guides and the duplicate-code, primitive-obsession, and long-method references.

The parser normalizes heading numbers with `Number(...)` at `ranking.ts:60`; the rewrite compares their original strings at `ranking.ts:350`. Smoke reproduced:
- `### 01.` → parsed `critical:1`, ranked above, then removed.
- Two `### 1.` headings → identical IDs; one above and one below, but both retained.

Use one canonical identity rule and block ambiguous duplicates.

**Cross-axis ranking: none.**

### Verification Status
- Phase goal achieved: **partial**.
- Scope adhered: yes; loop integration was not required.
- Out-of-scope changes made by this review: none.
- The phase’s `completed` metadata is not supported by the current implementation and verification evidence.

### Guardrails Verdict
- Contract: **durable**, version **2**
- Status: **fail**
- `unit_test_gate=fail`
- `global_ratchet=fail`
- `complexity_gate=pass`
- `patch_gate=advisory`
- `functional_test_gate=skipped`
- `lint_gate=skipped`

The failing test is the existing SQL-save case **“keeps phase provenance stable on retry but rotates a new phase’s source key.”** Vitest reported **1 failed, 1605 passed, 6 skipped**. The coverage command also exited 1, leaving current coverage unavailable; this is not evidence of a measured coverage regression.

### User Goal Analysis
- Goal: Avoid autonomous iterate spend on findings below the severity waterline.
- Met within this phase: callable scoring, deterministic waterline, audit-first persistence, ordinary filtering.
- Missing: reliable handling of absent file metadata, exact finding identity, and required failure history.
- Verdict: **partially met for Phase 2**. End-to-end routing belongs to Phase 3.

### Documentation Impact
No additional documentation impact for this callable-only phase. The planned routing documentation remains Phase 4 work.

### How-to Impact
No how-to impact; this phase adds no user-facing action.

### Issue Classification
- **In-plan:** three defects recorded in the iteration artifact.
- **Out-of-plan:** existing SQL-save verification failure. It is not included in the iteration artifact, but the required repository gate remains unsatisfied.

### Recommended Next Step
`/b-iterate` against this phase, then re-review. Restore the required repository verification gate—or obtain an explicit operator override—before closeout.

**Written and staged only:**
`.context/2026-10-03.review-severity-ranking/iterate-phase-2-jev-ranking-core.md`

Temporary smoke scripts and fixtures were removed. No implementation, phase-status, or loop-state changes were made.
