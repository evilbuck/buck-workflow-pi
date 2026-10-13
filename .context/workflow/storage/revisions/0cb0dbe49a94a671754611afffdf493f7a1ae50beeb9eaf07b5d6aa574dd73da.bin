## Plan Path Review: OMP token attribution by project and feature

### Plan Source
- File: `.context/2026-09-23.omp-token-attribution/plan-omp-token-attribution.md`
- Goal: Attribute OMP token usage and estimated cost to repositories and branches, including nested sessions.
- Baseline: Working tree against `HEAD` `717174b`; implementation remains uncommitted.

### Evidence Sources
- Modified implementation:
  - `extensions/index.ts`
  - `extensions/token-attribution/index.ts`
  - `extensions/token-attribution/git-identity.ts`
  - `extensions/token-attribution/db.ts`
  - `extensions/token-attribution/report.ts`
  - Five attribution test files
- Unrelated pre-existing model-config brainstorm changes excluded.
- Live database row confirmed for this repository, branch, provider/model, and 35,006 tokens.
- Actual OMP JSONL examined: outer entry timestamp `2026-09-23T22:12:54.794Z`; assistant message timestamp `2026-09-23T22:12:44.799Z`.
- Deterministic guardrails passed.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Git identity resolver | ✅ complete | `git-identity.ts:22-78`; origin, worktree, non-git, and detached behavior covered |
| 2. SQLite attribution table | 🔄 partial | Required table exists, but `db.ts:77-78,120-121` adds an unsafe semantic uniqueness constraint that can discard valid turns |
| 3. Usage extraction | ✅ complete | `index.ts:106-141`; token buckets, provider/model/API, cost, and fallback key extraction |
| 4. Live `message_end` recording | ✅ complete | Live `stats.db` row observed for this repository |
| 5. Nested JSONL ingestion | 🔄 partial | Incremental ingestion exists, but child-live and parent-scanned copies are not deduplicated with real OMP timestamps |
| 6. `/tokens` report | ✅ complete | Formatting, project/branch filtering, empty state, and command registration are covered |
| 7. Extension wiring | ✅ complete | `extensions/index.ts` wires the extension; live row proves loading |
| 8. Tests | 🔄 partial | Current tests pass but use equal event/JSONL timestamps, masking the nested double-count defect |

### Review Axes
- **Spec axis worst finding:** Blocking — nested deliveries can be counted twice, violating the explicit nested-session deduplication acceptance criterion.
- **Standards axis worst finding:** Blocking — an ad-hoc composite identity in `db.ts` both conflates legitimate records and fails to identify the same delivery across persistence stages.
- **Standards mode:** Sequential fallback, using TypeScript, universal quality, async, and security guidance plus relevant long-method, duplicate-code, and primitive-obsession definitions.
- **Cross-axis ranking:** None.

### Blocking Finding

`db.ts` adds uniqueness on:

```sql
(session_file, recorded_at, provider, model, total_tokens)
```

This fails in both directions:

1. **Double-counting:** A live child event uses the assistant message timestamp, while its persisted JSONL entry uses the later outer-entry timestamp. Direct reproduction inserted both representations of one 15-token turn and returned 30 tokens.
2. **Data loss:** Two legitimate entries with different `entry_key` values but otherwise identical semantic fields collide. Direct reproduction accepted the first and rejected the second.

The required invariant is uniqueness on `(session_file, entry_key)`. Event-time fallback rows must be explicitly reconciled with the later persisted entry ID.

### Guardrails Verdict
- Contract: `durable`
- Contract version: `2`
- Status: `pass`
- Gates:
  - `unit_test_gate=pass`
  - `functional_test_gate=skipped`
  - `lint_gate=skipped`
  - `patch_gate=pass`
  - `global_ratchet=pass`
  - `complexity_gate=pass`
- Coverage: 85.8% against an 84% baseline.
- Guardrails passing does not cover the reproduced delivery-identity defect.

### User Goal Analysis
- **Met:** Repository/branch identity, token buckets, estimated costs, live persistence, and project/branch reporting.
- **Partial:** Nested-session accounting exists but can produce incorrect totals.
- **Missing:** Reliable one-row-per-delivery behavior across child event-time writes and parent JSONL scans.
- **Verdict:** Partially met.

### Documentation Impact
- New extension module, persistence contract, and `/tokens` command require living documentation once correctness passes.
- Recommended: `/b-docs` after iteration.

### How-to Impact
- `/tokens [branch-or-project-substring]` is a new user-facing action.
- Recommended: `/b-howto`, or allow `/b-docs` to follow it.

### Issue Classification
- **In-plan issues:** 1 — delivery reconciliation and uniqueness are incorrect.
- **Out-of-plan issues:** None.

### Verdict
**Needs work**

Iteration artifact updated and reopened:

`.context/2026-09-23.omp-token-attribution/iterate-omp-token-attribution.md`

### Recommended Next Step
Supervisor should route the active iteration artifact through `/b-iterate`, then repeat `/b-review` against the same plan.
