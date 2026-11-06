## Plan Path Review: Phase 3 — Recall Patterns and Docs

### Plan Source
- File: `.context/2026-09-28.postgres-agent-memory/phase-3-recall-patterns-docs.md`
- Goal: Document recall/supersede/embeddings patterns and the store's operating rules, verified live against the registered tool
- Baseline: staged working tree vs `115f964` (all phase work uncommitted); phase-3 files are `docs/sql-memory.md` (staged A), `docs/howto/recall-project-memories.md` (staged A), `docs/howto/README.md` index line

### Evidence Sources
- Git status: full subject staged; phase-3-named files all present
- Live DB: fresh `pgvector/pgvector:pg18` container, schema 001 via `psql`, doc-matching seed; every doc-exact statement re-executed through `checkSqlStatement` + the tool's exact execution path (`extensions/sql-memory/index.ts:34-41`); container removed after
- Source inspection: `sql-gate.ts`, `migrations.ts`, `001_initial_schema.sql`, `migrations/README.md`, `index.ts`
- Prior rounds: both completed iterate artifacts' fixes confirmed present in current doc state

### Completion Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Digest (Q1–Q20), env var, tool modes, additive rule | ✅ complete | All 20 decisions present (Q5 in substance, line 10); modes match `index.ts:7-10`; ack semantics match `migrations.ts:72-75` + `migrations/README.md:8-14` |
| Recall query (all branches, seq order, skill × value) | ✅ complete | Re-ran doc-exact; output byte-identical to pasted block (`text_rank` 0.06079271; ranks 1.35/0.56/0.75) |
| Supersede flow (insert + close old row) | ✅ complete | INSERT/UPDATE/verify + trigger rejection all reproduced exactly |
| Embeddings how-to + HNSW additive sketch | ✅ complete | Backfill + NN read reproduced; `containsDestructiveMigration(sketch)`=true (ack claim holds); `USING hnsw (embedding vector_cosine_ops)` live-proven on pg18 |
| How-to Eat step per b-howto | ✅ complete | Step 5 **Eat**, format-compliant per `HOWTO-FORMAT.md`, indexed at `docs/howto/README.md:14` |
| Every example executed live, output captured | 🔄 partial | All 10 sql-mode examples byte-identical this review; HNSW sketch has no pasted output and runs via migrate-ack path, not the `sql` op — line 28's blanket "all examples … pasted verbatim" overreaches for it |

### Review Axes
- Spec axis worst finding: "Writable columns on `memories`: `invalid_at`, `superseded_by`, `value_score`" (`docs/sql-memory.md:11`) is verifiably incomplete — live-probed `UPDATE … SET seq = 99` → `rowCount:1` and `SET category = 'other'` → `UPDATE 1`; gate has no SET-column check, trigger omits `seq`/`category`/`id`
- Standards axis worst finding: near-duplicate recall query across the two docs (mitigated by the canonical-copy pointer added in round 2; how-to must stay keyboard-standalone per b-howto) — sequential fallback pass, general guides (docs-only diff)
- Cross-axis ranking: none (per-axis reporting only)

### Verification Status
- Goal achieved: yes (patterns documented and live-verified; precision defects remain)
- Scope adhered: yes; phase-3 diff is docs-only within its named files
- Out-of-scope changes: none attributable to phase 3 (other staged files are phases 1–2 / session artifacts, covered by prior rounds)

### Guardrails Verdict
- Contract: durable, version 2 — **pass** (`npm run guardrails:check`, 22s)
- Gates: unit_test_gate=pass (1126/1126), functional_test_gate=skipped (disabled), lint_gate=skipped (disabled), patch_gate=pass, global_ratchet=pass (88 ≥ 84), complexity_gate=pass (30/30 baseline, no new violations)
- Note: my first runner invocation stalled past 600s — pty-mode artifact of the invocation, not a contract failure; non-pty run passes cleanly

### User Goal Analysis
- Goal: document agent-driven recall patterns, embeddings usage, operating rules; verify live against the registered tool
- Met: all worked examples reproduce byte-for-byte through the tool's own gate and execution path; how-to format-compliant
- Partial: two precision gaps (writable-columns enumeration, verbatim-claim scope) + one toy-dims surprise
- Verdict: **met with named defects**

### Documentation Impact
No documentation impact beyond the phase's own doc files (the iterate fixes live inside them; no new convention/ADR/language).

### How-to Impact
No how-to impact — how-to exists, format-compliant, Eat present.

### Issue Classification
- In-plan issues (→ `/b-iterate`): 3, written to `.context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory-phase3-writable-columns.md` — ① incomplete writable-columns enumeration (critical, doc-only fix), ② line-28 verbatim claim vs HNSW section, ③ toy 4-dim embeddings vs sketch's `vector(1536)` (`expected 1536 dimensions, not 4`, hit live)
- Out-of-plan issues: 1 — optionally enforcing `seq`/`category` immutability in the trigger would be a phase-1-schema migration via fresh `/b-plan`; does not block this phase

### Verdict
**Needs work** — in-plan doc-precision defects; all fixes are wording-only in `docs/sql-memory.md`

### Recommended Next Step
`/b-iterate` (picks up `iterate-postgres-agent-memory-phase3-writable-columns.md`), then re-run `/b-review` against this phase.

---

**Report to supervisor:**
```
Summary
In-plan issues: 3 (doc-precision, iterate round 3 written) · Out-of-plan issues: 1 (optional trigger hardening)
All 10 sql-mode examples re-verified live, byte-identical outputs; HNSW ack semantics confirmed against gate + runner
Guardrails: durable v2 pass (unit 1126/1126, ratchet 88≥84, complexity clean)
Warnings: writable-columns enumeration incomplete (seq/category live-proven writable); line-28 verbatim claim overreaches; toy-dims vs vector(1536) mismatch fails live
Suggested next step: /b-iterate on iterate-postgres-agent-memory-phase3-writable-columns.md, then re-run /b-review on phase-3
Staged: iterate-postgres-agent-memory-phase3-writable-columns.md (only file I created; throwaway container and probe script removed)
```
