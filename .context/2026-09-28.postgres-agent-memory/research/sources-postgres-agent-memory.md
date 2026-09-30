# Sources: remote Postgres agent memory

Access date for this ledger: 2026-09-28.

## Session intake

- Source: user message in this session
- Type: primary requirement statement
- Key points: remote Postgres instead of `.context/memory/`; shared across projects; filter by project; multi-user; ranking by value/skill; context; order; git branch; Jev for intelligent store/use; summaries; OMP first

## Local contract

- Path: `skills/b-save/SKILL.md`
- Type: repository source
- Key point: `.context/memory/*.md` is the required git-portable session record; OMP `retain` / `learn` is an optional mirror. Hindsight HTTP and `b-memory-import` are not for routine saves.

## Jev / TypeSafe (consulted 2026-09-28)

- https://docs.typesafe.ai/introduction — three primitives; "No text generation, no parsing."
- https://docs.typesafe.ai/primitives — batching; questions are independent; dependent questions need a second call.
- https://docs.typesafe.ai/primitives/noul — yes probability only; no confidence field.
- https://docs.typesafe.ai/primitives/choice — label map, full distribution, separate confidence. Max 255 options.
- https://docs.typesafe.ai/primitives/score — 2–10 ordered levels; score may fall between levels.
- https://docs.typesafe.ai/confidence — confidence is peakedness, not P(chosen).
- https://docs.typesafe.ai/api — `POST /v1/systemone`; 401, 422, 429, 529.
- Local: `extensions/jev-tool/index.ts`, `extensions/typed-output/evaluator.ts`, `extensions/buck-loop/choice.ts`, `extensions/buck-loop/subject-choice.ts`, `extensions/buck-models/picker.ts`.

## Postgres (consulted 2026-09-28)

- https://github.com/pgvector/pgvector — types, dim caps, HNSW vs IVFFlat, operator classes.
- https://www.postgresql.org/docs/current/textsearch-tables.html — generated `tsvector`, GIN.
- https://www.postgresql.org/docs/current/textsearch-indexes.html — GIN preferred for text search.
- https://www.postgresql.org/docs/current/pgtrgm.html — trigram similarity for identifiers.
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html — RLS default-deny, FORCE, BYPASSRLS.
- https://www.postgresql.org/docs/current/sql-createpolicy.html — per-command policies.
- https://www.postgresql.org/docs/current/ddl-constraints.html — NULL foreign keys.
- https://www.postgresql.org/docs/release/18.0/ — temporal constraints, `uuidv7()`.
- https://www.postgresql.org/docs/current/rangetypes.html — `tstzrange`.
- https://wiki.postgresql.org/wiki/SQL2011Temporal — temporal table design.
- https://www.cybertec-postgresql.com/en/gaps-in-sequences-postgresql/ — gapless sequences are the wrong tool. Medium confidence.
- Sidecar cutoff (~10M vectors) is from secondary blogs, not official docs. Low-medium.

## Local repo (consulted 2026-09-28)

- `AGENTS.md` — memory layers; skills stay harness-neutral; extensions may call OMP APIs.
- `GLOBAL_OR_PROJECT-AGENTS.md` — required memory frontmatter.
- `skills/b-save/SKILL.md` — retain/learn mirror; no Hindsight HTTP on routine save.
- `skills/b-memory-import/SKILL.md` — one-shot backfill only.
- `extensions/index.ts`, `extensions/jev-tool/index.ts`, `extensions/fix-pr-feedback/index.ts` — `api.registerTool` surface.
- `docs/oh-my-pi.md` — `memory.backend` hindsight / mnemopi / local.
- `.context/2026-08-27.external-context-store/research/notes-durable-storage.md` — Hindsight already uses Postgres; use a separate schema.

## Landscape (consulted 2026-09-28)

- https://docs.mem0.ai/platform/features/entity-scoped-memory — user, agent, run, app, org filters. Exactly one primary entity.
- https://mem0.ai/blog/introducing-memory-decay-in-mem0 — search-time recency boost, not deletion. Medium confidence on the multipliers.
- https://arxiv.org/abs/2501.13956 — Graphiti bi-temporal edges.
- https://arxiv.org/pdf/2304.03442 — Generative Agents score = recency + importance + relevance.
- https://docs.letta.com/guides/core-concepts/memory/archival-memory — blocks, messages, passages on Postgres plus pgvector.
- https://docs.langchain.com/oss/python/langgraph/stores — namespace tuple plus JSONB in Postgres.
- https://docs.cognee.ai/core-concepts/multi-user-mode/multi-user-mode-overview — dataset boundary plus RBAC.
- https://github.com/crimson-knight/engram — per-branch memory files. Niche, not a mainstream pattern.
- https://arxiv.org/html/2508.00031v2 — GCC commit/branch/merge over agent context.

Full URL list is in the landscape scout report. Not every secondary blog was fetched by the mainline.

## OMP hooks (consulted 2026-09-28)

- `extensions/plan-artifact.ts` — `turn_end` scans session entries. Dedupes with a session marker.
- `extensions/tps-tracker.ts` — `message_end` filters `role === assistant`.
- `extensions/token-attribution/index.ts` — `message_end` records the turn. `agent_end` scans nested JSONL. Idempotency key `(session_file, entry_key)`.
- `docs/buck-workflow.md` — hook table: `turn_end`, `agent_end`, `message_end`.
