---
status: active
date: 2026-09-28
subject: 2026-09-28.postgres-agent-memory
topics: [postgres, agent-memory, jev, ranking, git-branch, multi-user, taxonomy]
informs: []
---

# Research: remote Postgres agent memory

## Summary

An OMP-first memory tool can use remote PostgreSQL plus pgvector. It should not replace Hindsight's tables, and it should not silently replace `.context/memory/`. Jev can rank, scope, and dedupe. It cannot write summaries. Mainstream agent-memory systems do not rank by author skill and do not scope to a git branch. Those two requirements are the actual design gap.

## Key findings

- **Jev is a classifier, not a writer.** Types are only `noul`, `choice`, and `score`. Fit: store/merge/reject, global/project/branch scope, value score, inject-or-skip, regenerate-summary trigger. Summary text and SQL stay outside. Confidence: high. https://docs.typesafe.ai/introduction
- **Postgres plus pgvector covers v1.** HNSW cosine, generated `tsvector`, explicit `seq` plus `created_at`, `uuidv7` ids. No sidecar vector database yet. RLS with `FORCE` fits a service role; `SET LOCAL` only if pooled. Confidence: high on features, medium on the 5–10M vector cutoff.
- **Scope is not exclusive.** A branch memory still belongs to a project. `project_id` null means global. `branch_id` null means not branch-scoped. Both may be set. The earlier XOR check would hide branch memories from project search.
- **Order and supersession are separate.** Store `seq` for conversation order. Close old facts with `invalid_at` (Graphiti) instead of deleting them. Do not chase gapless sequences.
- **Ranking formula nobody ships, but the parts exist.** Generative Agents uses recency + importance + relevance. Mem0 adds search-time decay. Author skill is absent everywhere reviewed. Store skill on the user. Let Jev score the memory. Combine in SQL: skill weight × value × recency decay × hybrid relevance.
- **Write path worth stealing.** Mem0 decides ADD/UPDATE/DELETE/NONE before insert. That is a Jev `choice`, then SQL.
- **Three tiers, not one blob.** Raw episode (context), extracted fact (searchable memory), generated summary (LLM text, Jev only triggers refresh). Letta and Graphiti both split raw from extracted.
- **Local lock.** Skills must not open Postgres. Register the tool with `api.registerTool` beside `jev` and `fix_pr_feedback`. Hindsight already speaks Postgres; use a separate schema. `.context/memory/` remains the git-portable session record unless the user explicitly overrides that rule.
- **Git branch is a niche, not a product feature.** Engram, Letta Context Repositories, and GCC do versions of it. Mem0, Graphiti, Letta archival, Cognee, and LangGraph do not.
- **Categories are a closed set Jev can grow only by promotion.** User wants methodology, tool, project knowledge, and preference distinguished, and wants Jev to extend the taxonomy. Jev cannot author the label. Seed the `choice` criteria. `other` plus an external label proposal plus a distinctness `noul` creates a candidate. Promote after reuse or a human confirm. Tags for retrieval are a separate many-to-many, not the category.
- **Post-turn capture is additive.** OMP already exposes `turn_end`, `message_end`, and `agent_end`. Evaluate on `turn_end` (full turn, one judgment). Do not write from `message_end`. Explicit store and `/b-save` remain. Idempotency key: session file plus entry id. Confidence: high that the events exist in this repo. Nested-session coverage is unproven.

## Sources consulted

Official docs and papers first: TypeSafe, PostgreSQL 18, pgvector, Mem0 docs, Graphiti paper, Generative Agents paper, Letta docs, LangGraph store docs, Cognee multi-user docs. Local: `skills/b-save/SKILL.md`, `extensions/index.ts`, `.context/2026-08-27.external-context-store/`. Ledger: `research/sources-postgres-agent-memory.md`.

## Recommendations

1. OMP extension tool first. Harness-neutral skill names the operations and calls the tool. No Postgres connection inside a skill.
2. Own schema, not Hindsight's. Keep `.context/memory/` as the reviewable session record until an explicit override.
3. Tables: `users` (stored skill weight), `projects`, `branches`, `episodes` (raw context, ordered by `seq`), `memories` (extracted facts, project and optional branch, one primary category, embedding, `tsvector`, `value_score`, `valid_at`/`invalid_at`, optional `commit_sha`), `categories` (slug, description, status candidate|active), `memory_tags`, `memory_ranks` (cross-team ratings, separate from the author), `summaries` (LLM body, Jev trigger only).
4. Recall: filter to current branch + its project + global, drop `invalid_at` rows, hybrid search, rank by skill × value × recency × relevance, then Jev `noul` over that shortlist only. Writes arrive three ways: explicit tool, `/b-save`, and `turn_end`. Same Jev gate on all three.
5. On merge, close branch-scoped facts (`invalid_at`) and optionally promote a copy to project scope. Do not make promotion implicit.
6. Skip a graph database and a dedicated vector sidecar for v1.

## Open questions

- Replace `.context/memory/` or keep it beside Postgres? Locked rule says keep it. User said "instead of".
- Who sets author skill: a human, a team admin, or a stored default?
- Branch name only, or branch plus commit? Promotion on merge, or leave branch facts closed and unpromoted?
- Shared by default, or private until promoted?
- Embedding model and dimension, which picks `vector` vs `halfvec`.
- Should a new category promote automatically after repeated `other`, or only after a human confirms the label?
