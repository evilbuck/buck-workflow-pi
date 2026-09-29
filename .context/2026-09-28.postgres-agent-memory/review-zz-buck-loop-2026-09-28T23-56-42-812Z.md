## Plan Path Review: Phase 3 — Recall Patterns and Docs

### Plan Source
- File: `.context/2026-09-28.postgres-agent-memory/phase-3-recall-patterns-docs.md` (status `completed`)
- Goal: document agent-driven recall/embedding patterns and the store's operating rules, verified live
- Baseline: working tree vs `115f964`; phase-3 evidence from `buck-loop.log.jsonl` build trail (23:44–23:47Z) + live DB replay checks

### Evidence Sources
- Modified (staged): `docs/sql-memory.md` (+183), `docs/howto/recall-project-memories.md` (+27), `docs/howto/README.md` (+1 index line), phase file, backlog item
- Live-execution trail: docker `pgvector/pgvector:pg18` on 55432 → migration 001 via psql → seed SQL (skill weights 1.5/0.8, value_scores 0.9/0.7/0.5) → probe through registered `sql_memory` tool (`/tmp/sql-memory-phase3-probe.mts`, 2 runs both `ok:true`, incl. a correct gate denial of `websearch_to_tsquery`)
- Reviewer-run verification: all 11 documented statements pass the project's own `checkSqlStatement` gate (throwaway script, `/tmp`)

### Completion Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Decision digest, env var, tool modes, additive-migration rule | ✅ complete | `docs/sql-memory.md:5-13`; every Q-cite cross-checked against `grill-session-*.md` (Q1–Q20 all match) |
| Recall query: all branches, branch as context, seq order, skill × value | ✅ complete | `docs/sql-memory.md:29-58`; projection has branch/SHA, `ORDER BY m.seq`, `skill_weight × COALESCE(value_score,0)` |
| Supersede flow: insert successor, close old row | ✅ complete | `docs/sql-memory.md:81-125`; writable-column claim matches trigger in `migrations/001_initial_schema.sql:92-113`; pasted trigger error is verbatim |
| Embeddings how-to + per-model HNSW additive sketch | ✅ complete | `docs/sql-memory.md:127-175`; PK `(memory_id, model)` and immutability match schema; operator-class mapping correct; live experiments (ALTER attempt → per-model table) visible in log |
| Eat step per b-howto | ✅ complete | `recall-project-memories.md:25` observable check; numbered steps, indexed in README — conforms to `b-howto/SKILL.md` |
| Every example query executed live; output captured | 🔄 partial | All queries ran through the tool (log-proven; outputs arithmetically consistent with seed: 1.35/0.56/0.75, ts_rank 0.06079271) **but** ledger-check output not pasted despite line-27 "pasted verbatim" claim |

### Review Axes
- Spec axis worst finding: verbatim-output claim vs missing ledger-check output (criterion 6 partial)
- Standards axis worst finding: supersede example keys project by non-unique `projects.name` instead of the doc's own canonical identity key `origin_url` (sequential fallback pass — no background dispatch available; seeded general guides, diff is docs-only)
- Cross-axis ranking: none (per-axis reporting only)

### Verification Status
- Goal achieved: yes (docs deliverables exist, live-verified; residual polish below)
- Scope adhered: yes; no out-of-scope edits — code changes in tree belong to phases 1–2
- Out-of-scope changes: none

### Guardrails Verdict
- Status: — (docs-only). This session's changed paths are all `.md` under `docs/`/`.context/`; contract (`guardrails.json`, durable v2) skipped per docs-only rule. Phase-2 code gates unaffected by this phase.

### Documentation Impact
- Phase-3 deliverables *are* living docs; no further `/b-docs` action for this phase's scope. Plan-level signal (`.context/memory` → SQL store replacement convention now realized) is already tracked for closeout `/b-docs`.

### How-to Impact
- None — `recall-project-memories.md` created per format with Eat, indexed.

### Issue Classification
- In-plan (→ `/b-iterate`): verbatim-output claim overreach (critical, `docs/sql-memory.md:27` vs `:177-183`); name-vs-origin_url project key in supersede example (warning); executed variant ≠ doc-exact query text — equivalent and gate-verified, one live re-run would close it (warning)
- Out-of-plan: none

### Verdict
**Needs work** — small in-plan doc defects; core deliverables verified live and correct.

### Recommended Next Step
`/b-iterate` on `.context/2026-09-28.postgres-agent-memory/iterate-postgres-agent-memory-phase3-docs.md` (staged), then re-run `/b-review` against this phase file.

---
**Summary** — In-plan issues: 3 (1 critical, 2 warnings) · Out-of-plan: none · Guardrails: docs-only, skipped · Artifact `iterate-postgres-agent-memory-phase3-docs.md` written and staged; no pre-existing changes staged.
