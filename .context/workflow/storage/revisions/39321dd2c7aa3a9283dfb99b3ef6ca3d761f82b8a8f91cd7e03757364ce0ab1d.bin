## Plan Path Review: Phase 3 — Recall Patterns and Docs

### Plan Source
- File: `.context/2026-09-28.postgres-agent-memory/phase-3-recall-patterns-docs.md` (marked `completed`; this is the second review pass — first round's findings fixed in `iterate-postgres-agent-memory-phase3-docs.md`)
- Goal: document recall/supersede/rank/embedding patterns, verified live against the registered tool
- Baseline: staged working tree vs `115f964`; phase scope = `docs/sql-memory.md`, `docs/howto/recall-project-memories.md` (+ howto README index line). Adjacent doc edits (`buck-workflow.md`, `extension-loading.md`, `oh-my-pi.md`) are phase-2 extension-registration docs, not phase-3 scope violations.

### Evidence Sources
- Docs read in full; cross-checked against `migrations/001_initial_schema.sql`, `extensions/sql-memory/index.ts`, `sql-gate.ts`, `migrations.ts`, `migrations/README.md`, grill-session digest
- Fresh deterministic probes: all 10 sql-mode statements in `docs/sql-memory.md` + the how-to query pass the project's own `checkSqlStatement` gate; `websearch_to_tsquery` denied exactly as the doc claims; doc's allowlist note matches `SAFE_FUNCTIONS` verbatim
- `containsDestructiveMigration` probe over the doc's HNSW sketch: **all three statements ack-required**
- Live DB re-run not possible (no `SQL_MEMORY_URL`, memory container stopped) — relied on recorded live-execution evidence in the completed iteration artifact plus fresh gate-level verification

### Completion Matrix

| Criterion | Status | Evidence |
|---|---|---|
| 1. Q1–Q20 digest, env var, tool modes, additive rule | 🔄 partial | env var ✅ (`index.ts:56-57`), tool modes ✅ (`index.ts:7-10`), 19/20 decisions recorded; **Q11 substance absent** (skill_weight/`memory_ranks` writable via tool — grill:41,51-52) |
| 2. Recall example (all branches, seq order, skill × value) | ✅ complete | doc:29-58; schema cols match 001; gate-allowed; doc-exact re-execution recorded in prior iteration |
| 3. Supersede flow (insert successor + close old) | ✅ complete | doc:81-125; keys by `origin_url` (prior iteration fix); writable cols match trigger 001:92-113 |
| 4. Embeddings how-to + per-model HNSW sketch | 🔄 partial | backfill + NN read ✅ (gate-allowed); HNSW sketch present but **not applicable via plain `migrate`** |
| 5. Eat step | ✅ complete | howto:25, registered in howto README |
| 6. Every example executed live, output captured | 🔄 partial | sql-mode examples + ledger output ✅ (pasted, re-verified in prior iteration); HNSW sketch verified via raw SQL only — the registered tool's migrate op **refuses it without ack** |

### Review Axes
- Spec axis worst finding: HNSW sketch labeled `(applied via { op: "migrate" })` but every statement is outside the autonomous additive grammar — plain migrate throws `Non-additive migration … requires explicit acknowledgment`; Operating rules (line 10) also misdescribe `destructive` ack as covering only `DROP`/`TRUNCATE`/deletes, contradicting `migrations/README.md:8-14`
- Standards axis worst finding (sequential fallback pass — no background dispatch in this harness; seeded with `code-review-best-practices.md` + `code-quality-universal.md` per docs-only diff): recall query duplicated across both docs — drift risk on schema change, partially mitigated by the how-to's link (minor)
- Cross-axis ranking: none (per-axis reporting only)

### Verification Status
- Goal achieved: partial — docs are strong on recall/supersede/embeddings reads; two accuracy gaps vs locked tool behavior
- Scope adhered: yes; no out-of-scope changes
- Out-of-scope changes: none

### Guardrails Verdict
- Contract: durable (v2), Status: **pass**
- Gates: unit_test_gate=pass, functional_test_gate=skipped (disabled), lint_gate=skipped (disabled), patch_gate=pass (advisory), global_ratchet=pass (88 vs 84), complexity_gate=pass

### Documentation Impact
- No additional impact — the phase's deliverable *is* living docs; both defects are fixes to it, not missing doc locations.

### How-to Impact
- No how-to impact — the how-to exists and is registered; warning 2 is a wording fix inside it.

### Issue Classification
- In-plan issues (→ `/b-iterate`): (1) HNSW sketch un-runnable as documented + `destructive`-ack semantics drift; (2) Q11 missing from digest. Artifact written: `.context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory-phase3-migrate-ack.md` (staged; only file I created)
- Out-of-plan issues: none

### Verdict
**Needs work** — two in-plan doc-accuracy defects (criteria 1, 4, 6 partial). Both fixes are documentation-only; the iterate artifact explicitly warns against widening the additive grammar to make the sketch autonomous (that ack requirement is locked phase-2 behavior).

---

**Summary**
In-plan issues: 2 · Out-of-plan issues: none
Warnings: 2 (query duplication across docs; how-to step-1 wording)
Suggested next step: `/b-iterate` on `iterate-postgres-agent-memory-phase3-migrate-ack.md`, then re-run `/b-review` against this phase.
