# Rolling notes: remote Postgres agent memory

## Intake (user, 2026-09-28)

Source: this session, not an external document. Confidence: high for requirements, low for design.

### Stated requirements

- Agent tool, OMP first. Harness-agnostic is desirable later, not the first milestone.
- Remote PostgreSQL replaces storing memories in `.context/memory/` (user wording: "instead of"). Conflicts with the current two-layer rule; unresolved.
- One store shared across all projects.
- Search memories by project.
- Multiple users share memories.
- Ranking: some memories are more valuable than others. Cross-team recall should not treat a less-skilled engineer's memory as equal to a stronger engineer's.
- Memories carry context.
- Memories have order.
- Memories are tied to a git branch (added mid-intake).

### Intelligent use (unstated design, user asked to flesh out)

- Store and retrieve with typesafe.ai/jev for closed judgments.
- Intelligent summaries.
- Techniques not yet named. Research is supposed to surface those.

### Not yet decided

- Whether `.context/memory/` remains the git-portable session record.
- Who assigns skill or rank: human, Jev, or both.
- Branch grain: branch name only, or branch plus commit SHA. What happens on merge.
- Visibility default: shared immediately, or private until promoted.
- Embedding model and whether pgvector is required on day one.

## Prior local decision (do not silently overturn)

`.context/memory/*.md` is the required git-portable session record. OMP `retain` / `learn` is an optional harness mirror. Source: `skills/b-save/SKILL.md` "Two memory layers". Confidence: high that this is the current contract. The user may be asking to supersede it.

## Jev fit (docs.typesafe.ai + local extensions, 2026-09-28)

Confidence: high. Jev has exactly three question types: `noul`, `choice`, `score`. No summary or free-text type. Official line: no text generation. Source: https://docs.typesafe.ai/introduction

Closed memory decisions that fit:

- Store / merge / reject duplicate: `choice` over `{store, merge, reject}`. Embeddings and the SQL write stay outside Jev.
- Scope global / project / branch: `choice`. Needs the note plus current repo and branch in `state`.
- Value given author skill: `score` on a fixed 2–10 level rubric. Threshold lives in code, not in the question.
- Which retrieved memories to inject: one `noul` per candidate in a single `systemOne` call. Retrieval itself stays in SQL.
- Whether to regenerate a summary: `noul` trigger, optional `score` for staleness. The summary text is an LLM or template, not Jev.

Batching is allowed. Questions in one call are independent. A decision that depends on a prior answer needs a second call.

Local wiring already exists: `extensions/jev-tool/index.ts` passthrough, `extensions/typed-output/evaluator.ts` fail-closed (`missing_credentials`, `provider_unavailable`, `invalid_request`). Noul has no separate confidence field; `noul` near 0.5 means uncertain, not medium value.

Implication: ranking can be a Jev score plus a stored author-skill weight. Summaries cannot be a Jev output.

## Postgres capabilities (official docs + pgvector README, 2026-09-28)

Confidence: high on features, medium on the sidecar cutoff.

Postgres plus pgvector is enough for v1. Do not add Qdrant or Weaviate until the corpus is large (scout cited ~5–10M vectors; that cutoff is blog-grade, not a Postgres guarantee).

- Embeddings: `vector(N)` if N ≤ 2000. `halfvec` up to 4000. HNSW, not IVFFlat, because memories arrive continuously. Cosine operator class must match the query operator or the planner seq-scans.
- Hybrid search: generated `tsvector` + GIN, plus HNSW, fused with reciprocal rank fusion in one query. `pg_trgm` is for typo-tolerant slugs and branch names, not a replacement for full text.
- Scope: nullable foreign keys plus `CHECK (num_nonnulls(global_id, project_id, branch_id) = 1)`. A single `scope_kind` column loses referential integrity.
- Order: store an explicit per-thread `seq` plus `created_at`. Do not reconstruct order from timestamps. Do not chase gap-free sequences. `uuidv7()` is the external id if time order matters.
- Multi-user: RLS with `FORCE ROW LEVEL SECURITY` fits a service role. `SET LOCAL` only, because a pooler in transaction mode drops session GUCs. Application-level `WHERE` is simpler if every query already goes through one trusted path.
- Branch validity over time can wait. PG18 `WITHOUT OVERLAPS` is the later tool, not v1.

What Postgres will not do for us: ancestor-permission inheritance must be materialized at write time. Skill ranking is an application column, not a built-in.

## Provisional schema sketch (not a decision)

Confidence: low. Landscape and local tool constraints are not in yet. This is a filing sketch so the session can be resumed.

Tables:

- `users`: `id uuid` default `uuidv7()`, display name, stored skill weight. Jev reads the weight. It does not invent it.
- `projects`: slug, repo URL, default branch name.
- `branches`: project FK, branch name, optional head SHA. Unique `(project_id, name)`.
- `memories`: author FK; body; `context jsonb`; kind; exactly one of global marker, project FK, branch FK; explicit `seq`; `created_at`; optional commit SHA; embedding; generated `tsvector`; persisted value score; `superseded_by`.
- `memory_ranks`: memory FK, optional rater, rubric level, numeric score, created_at. Separate from the memory row so cross-team ratings do not overwrite the author.
- `summaries`: same scope check, body written by an LLM, ids covered, generated_at. Jev only triggers regeneration.

Retrieval order, not storage order: filter by scope (branch, else project, else global), hybrid rank, then multiply or sort by author skill weight and persisted value score. Injection is a Jev `noul` over the shortlist, not over the whole table.

## Local constraints (repo scan, 2026-09-28)

Confidence: high. This workspace is buck-workflow-pi. There is no Postgres client or sql-memory implementation in source.

Locked:

- `.context/memory/*.md` is the required git-portable record for every harness. Frontmatter is fixed: date, domains, topics, related, priority, status. Source: `AGENTS.md` memory layers and `GLOBAL_OR_PROJECT-AGENTS.md`.
- Skills must not open Postgres, call Hindsight HTTP, or call Jev. Extensions own those calls. Precedent: `extensions/jev-tool/index.ts` and `extensions/fix-pr-feedback/index.ts` via `api.registerTool`, wired from `extensions/index.ts`.
- `/b-save` may mirror facts through OMP `retain` / `learn`. It must not call Hindsight HTTP. Bulk import is `b-memory-import` only, one-shot, stable document id, no LLM.
- Hindsight is already a remote memory store and already speaks Postgres. A new store needs its own schema or database. Source: `.context/2026-08-27.external-context-store/research/notes-durable-storage.md`. Do not reuse Hindsight tables.

Extension point, not a violation: new `extensions/<name>/` tool, harness-neutral skill that names the operation, optional backfill script shaped like `b-memory-import`.

The intake line "instead of `.context/memory/`" contradicts the locked two-layer rule. That is a decision for the user, not a default.

## Landscape (Mem0, Graphiti, Letta, Cognee, LangGraph, Generative Agents, 2026-09-28)

Confidence: high on schema shapes from official docs. Medium on Mem0 decay constants (vendor blog). Low on Zep Cloud internals.

Shared pattern: write-time extract or update, namespace scoping, hybrid vector plus keyword retrieval. Three tiers show up repeatedly: pinned in-context block, raw episode, extracted long-term fact.

Nobody in the mainstream five stores git branch or commit. Niche only: Engram (per-branch SQLite), Letta Context Repositories, GCC (`arxiv.org/html/2508.00031v2`). Author-skill weighting is also absent. Closest ranking is Generative Agents: recency decay 0.995 plus LLM importance 1–10 plus embedding relevance, equal weights. Mem0 decay is search-time, about 1.5× fresh to 0.3× stale, not a delete.

Supersession worth stealing: Graphiti closes `invalid_at` on the old fact and opens a new edge. Mem0 uses ADD/UPDATE/DELETE/NONE at write time. That maps to our Jev `choice` before SQL.

Do not copy: XOR "exactly one entity" (blocks project-and-branch queries), Cognee's one-database-per-tenant, Letta's agent-decided paging, Zep's hosted context lake.

## Schema revision

The earlier `num_nonnulls = 1` scope check is wrong for this brief. A branch memory still belongs to a project, and project search must find it.

Corrected shape: `project_id` null means global. `branch_id` null means not branch-scoped. Both may be set. `commit_sha` optional. Close a branch fact on merge by setting `invalid_at`, do not delete it. Promotion to project scope is a separate write, not an implicit side effect.

## Categories and tags (user, 2026-09-28)

User wants tags so memories can be categorized. Examples given: task methodology, tools or frameworks that solve an engineering problem, project-specific knowledge, preferences. Wants a reasonable seed set, and wants Jev to be able to grow the taxonomy.

Constraint: Jev cannot emit a new label string. It can only choose among labels we send, or score/noul a candidate someone else wrote. Taxonomy growth is a promotion loop, not a Jev write.

Draft split, not locked:

- One primary category. Seed: methodology, tool, project, preference, decision, pitfall, convention, plus `other`.
- Many tags for retrieval (`postgres`, `rails`). Separate table. An outside proposer suggests slugs. Jev only maps them onto existing tags or accepts a candidate.
- A new category stays `candidate` until it is distinct from the active set (Jev `noul`) and has repeated use or a human promote. Then it joins the next `choice` criteria.

## After-output capture (user, 2026-09-28)

User wants an OMP hook to evaluate completed output and write memories. This adds a capture path. It does not replace an explicit store tool or `/b-save`.

OMP extensions already register these events:

- `message_end` — one assistant message, including tool-call messages. Used by `extensions/tps-tracker.ts` and `extensions/token-attribution/index.ts`. Too fine for memory writes.
- `turn_end` — once per completed turn. `extensions/plan-artifact.ts` scans `ctx.sessionManager.getEntries()` here. Right evaluation point: tools plus final text, one Jev pass.
- `agent_end` — end of the agent run. Model restore and token wrap-up. Too coarse as the only hook. Nested sessions are a gap: token attribution scans nested JSONL on `agent_end` because the parent hook does not see child turns.

Write rule: `turn_end` runs store/merge/reject, category, scope, and value. SQL writes only on store or merge. Idempotency key is session file plus entry id, same idea as plan-artifact's marker and token-attribution's `(session_file, entry_key)`. A repeated `turn_end` must not insert twice.

## Grill Q1 (user, 2026-09-28)

Resolved. Ultimate plan is to replace `.context/memory/` with Postgres. Do not migrate existing memories. User withdrew the migration phase: task-specific `.context/` memories go stale and are not worth importing. This is an explicit override of the locked two-layer rule for new memory. It is not a backfill.

## Grill Q2 (user, 2026-09-28)

Resolved. The rest of `.context/` moves to Postgres, but that move is phase 2. Phase 1 replaces memory only and does not import existing memories.

## Grill Q3 and tool shape (user, 2026-09-28)

Phase 1 leaves plans, specs, research, and backlog on disk. Memory first.

User does not want a prescribed memory workflow. Phase 1 should give the agent a SQL tool and an intelligent schema, then let it query and write. They expect usage to improve the system more than a fixed store/merge/reject pipeline. The earlier `turn_end` hook and mandatory Jev gate are now in tension with this. Not yet resolved whether those are dropped for phase 1 or only made optional.

## Grill: migrations (user, 2026-09-28)

User wants a way to manage database schema migrations, not only memory queries. This repo has no existing migration runner. Q4 (Jev gate and `turn_end`) is still open. The live fork is whether DDL is inside the memory SQL tool or a separate versioned path.

## Grill Q6 (user, 2026-09-28)

Resolved. Memory body is not updated in place. A correction is a new row. The old row gets `invalid_at` and a successor pointer. Rank and skill rows may still be updated. Q4 and Q5 remain open.

## Addendum, not Q7 (user, 2026-09-28)

User wants `b-grill-me` to classify each turn with Jev before treating it as an answer. Labels: direct answer, addendum, arbitrary thought. That message was an addendum. The skill now has the rule. Q4 and Q5 remain open.

## Grill Q7 (user, 2026-09-28)

Resolved. Schema rejects memory-body updates. Not a convention. `invalid_at` and the successor pointer stay writable. Rank and skill tables stay writable.

## Grill Q4 (user, 2026-09-28)

Resolved. Phase 1 is a SQL tool over the memory schema. No required Jev gate. No `turn_end` auto-writer.

## Grill Q5 (user, 2026-09-28)

Resolved. Schema changes are a separate versioned migration path. Memory SQL cannot run DDL. The agent applies migrations.

## Grill Q8 (user, 2026-09-28)

Resolved. The agent applies migrations on its own, not only when asked. Classified `direct_answer`. Destructive DDL is still open.

## Grill Q10 (user, 2026-09-28)

Resolved. Autonomous migration apply is additive only. `DROP`, `TRUNCATE`, and row-deleting statements wait for an explicit ask. Classified `direct_answer` by session `jev`.

## Grill Q11 (user, 2026-09-28)

Resolved. The memory SQL tool can change a user's skill weight. Autonomous writes allowed; no human gate. This overrides the mainline recommendation (guard skill weight like destructive DDL). Classified `direct_answer` by session `jev`.

## Grill Q12 (user, 2026-09-28)

Resolved. Branch-scoped memories stay valid after merge. Branch is provenance — where and when the memory came from — not a validity window. Merge triggers no close and no promotion. This overturns the earlier "close on merge, promote explicitly" sketch. `invalid_at` is only for supersession by a successor memory, never for merge.

## Grill Q13 (user, 2026-09-28)

Resolved. Recall returns project memories from all branches. The branch column is displayed as context. No current-branch filter at query time. Classified `direct_answer` by session `jev` (0.99).

## Grill Q14 (user, 2026-09-28)

Resolved. Memories are visible to all users immediately on write. No private staging, no promotion workflow, no visibility column. RLS is off the critical path for v1. Classified `direct_answer` by session `jev` (1.0).

## Grill Q15 (user, 2026-09-28)

Resolved. Author identity is the local `git config user.email`, stamped on every write. Single-user system for now. Alias normalization (work vs personal email fragmenting one human into two authors) is out of scope for v1. First re-ask was classified `addendum` (0.7) because the turn named a mechanism outside the offered options; clean confirm then scored 0.98.

## Grill Q16 (user, 2026-09-28)

Resolved. Project identity is the git origin URL; absolute git common dir is the fallback when no remote exists. Same rule as `extensions/token-attribution/index.ts`. Linked worktrees share one project; detached or non-git work falls back to cwd. Classified `direct_answer` by session `jev` (1.0).

## Grill Q17 (user, 2026-09-28)

Resolved. Embeddings ship in v1 as a separate `memory_embeddings (memory_id, model, dims, embedding)` table. No embedding column on `memories`, so no dimension is fixed at migration time and model choice stays open. Embeddings are optional; the agent decides when and how to use them. Full-text `tsvector` works from day one. Acceptance turn was split: agent-discretion clause filed as addendum (0.91), clean confirm scored 1.0.

## Grill Q18 (user, 2026-09-28)

Resolved. Connection string lives in an environment variable, `SQL_MEMORY_URL`, read at tool registration — the `TYPESAFE_API_KEY` pattern. No OMP settings dependency for v1. Classified `direct_answer` by session `jev` (1.0).

## Grill Q19 (user, 2026-09-28)

Resolved. Tool is always registered when `SQL_MEMORY_URL` is set. The env var is the single opt-in; no second flag. Classified `direct_answer` by session `jev` (1.0).

## Grill Q20 and threshold (user, 2026-09-28)

Resolved. Branch provenance is branch name plus commit SHA. Overrides the name-only recommendation; the SHA column ships in migration 001. Classified `direct_answer` by session `jev` (0.99).

Threshold (20) reached. Boundary assessment: boundaries_found. Four domains — capture/canonical record, identity, retrieval, runtime config — map to three buildable phases inside v1 (schema+migrations, extension+tool, recall+embeddings), plus the user-declared external phase 2 for the rest of `.context/`.
