---
status: active
date: 2026-08-27
subject: 2026-08-27.external-context-store
topics: [durable-storage, hindsight, vector-store, collections]
---

# Notes: Durable storage for external context

Research question: should the collection payload live in a vector store (specifically Hindsight), and would that be enough for pointer-file + DB collections?

## Requirements (from brainstorm + grill, not re-litigated here)

- Exact artifact bytes (markdown plans/memory/backlog), not embeddings of them
- Fetch by `collection_id` (and likely snapshot), not by semantic similarity
- Hydrate into worktree `.context/`
- Teammate opt-in via credentials
- Unmerged work stays dark (CSV at HEAD is the filter)

### Local skill: hindsight-http-api

- Consulted: `skills/hindsight-http-api/SKILL.md` (this repo)
- Confidence: high for *this environment's* Hindsight (bilby instance, bank `evilbuck`)
- Findings:
  - Write path is `POST /v1/default/banks/{bank}/memories` with `MemoryItem` (`content` required; optional `document_id`, tags, metadata, strategy, update_mode).
  - **Every retain runs LLM fact extraction.** Cost note: ~13k input tokens per 4 items. Explicit warning: do not push raw chat dumps.
  - Verify/list returns *extracted facts* (`fact_type: world|experience`), not original documents.
  - Recall is **semantic** (`POST .../recall` with `query`).
  - OpenAPI advertised as 154 schemas at v0.9.1 on this instance.
- Bears on question: Hindsight-as-used-here is a **fact/memory bank with embeddings**, not a blob/document store. Using it as the source of truth for `.context` files would (a) destroy byte fidelity via extraction, (b) cost an LLM pass per write, (c) make hydrate a recall-ranking problem instead of a key lookup.

### Local skill: b-memory-import

- Consulted: `skills/b-memory-import/SKILL.md` + `scripts/import-context-memory.ts`
- Confidence: high
- Findings:
  - Importer is **one-shot/backfill**, not the every-save path. It walks `.context/memory` (optional backlog items), builds a retain item with header+body (cap ~48k chars), stable `document_id = buck-ctx-mem:<slug>:<path-sha20>`, `update_mode: replace`.
  - Verification is `recall` on a known topic — search, not round-trip file identity.
  - Content is framed for the extractor ("session record" / "backlog item"), which is the opposite of byte-preserve hydrate.
- Bears on question: this repo already treats Hindsight as a **search index over `.context`**, not a replacement for it.

### Session record: two-layer memory (2026-08-14)

- Consulted: `.context/memory/omp-context-memory-hindsight-2026-08-14.md`, `docs/oh-my-pi.md`, `docs/buck-workflow.md`
- Confidence: high (locked project decision)
- Findings:
  - Layer 1: git-portable `.context/memory` is required.
  - Layer 2: OMP LTM (`retain`/`recall`/`reflect`) is optional mirror.
  - Explicit: **Do not replace `.context/memory` with LTM alone.**
- Bears on question: using Hindsight as the collection SoT would reverse a decision made two weeks ago for the same artifacts.

### Live Hindsight 0.9.1 OpenAPI + `/version`

- Consulted: `GET https://proxmox.tiger-goanna.ts.net:8888/version` and `/openapi.json` (bilby instance)
- Type: Official Documentation (deployed API)
- Confidence: high for this deployment; medium as "what Hindsight is in general" (no public GitHub repo found via search)
- Findings:
  - Feature flags: `store_document_text: true`, `file_upload_api`, `document_import_api`, `document_export_api`.
  - Hindsight is **not only a vector store**. It has: extracted memory units (graph, recall, reflect), **documents** with `original_text`, knowledge-base pages (LLM-generated, hybrid BM25+vector search), file upload that converts then retains.
  - `GET /documents/{document_id}`: "Get a specific document including its original text." Schema `DocumentResponse` required fields include `id`, `original_text` (nullable), `content_hash`, `memory_unit_count`.
  - `GET /documents` lists sources "from which memory units are extracted." Filters: substring on **document id** (`q`), tags. No `collection_id` / snapshot query.
  - `POST /memories` (retain) still extracts facts. `document_id` groups items into one document. `update_mode: replace|append` reprocesses. `strategy` can override bank retain strategy — **no evidence of a skip-extraction strategy** in the public schema (bank config is an opaque object).
  - `POST /files/retain`: upload PDF/DOCX/etc → object storage (Postgres default, S3 production) → markdown → extract facts. Object storage is an implementation detail of the memory pipeline, not a KV API for our CSV ids.
  - Knowledge-base pages: "Content is generated asynchronously" from mental models. Wrong layer for authoring `.context` markdown.
- Bears on question:
  - **Vector search is not enough** for hydrate (need key lookup).
  - **Hindsight-as-document-store is theoretically possible** (`original_text` round-trip if `store_document_text`) but would (1) run LLM extraction on every plan/memory write, (2) pollute bank `evilbuck` with file dumps unless a dedicated bank, (3) encode collection/snapshot into `document_id` or tags because there is no collection API, (4) still not provide git-ancestry (CSV remains the filter).
  - Category error: Hindsight is a **memory system that happens to keep source text**. The collection store needs a **document/KV table**.

### Vector store vs key-value (synthesis)

- A vector index answers "what is similar to this query?" Hydrate answers "give me every artifact in snapshot S of collection C."
- You can *add* embeddings later for agent search (that is today's Hindsight layer). They cannot *replace* primary-key storage.
- Pure vector DBs (Pinecone, Chroma, etc.) fail the hydrate contract even harder than Hindsight: no `original_text` GET-by-id designed as SoT, ranking not identity.

### Alternatives (not fully sourced — landscape only)

- **SQLite/libSQL/Turso table** `(collection_id, snapshot_id, path, content, sha256)` — matches the grill data model; Turso-style hosted sqlite gives machine-to-machine + teammate tokens without sharing the memory bank.
- **Postgres table** — Hindsight already speaks Postgres; a *separate* schema/database avoids extraction. Do not reuse Hindsight tables.
- **S3/MinIO object** keyed `/{collection}/{snapshot}/{path}` — fine for blobs; still need the CSV as the ancestry index.
- Rejected as SoT: git notes, sidecar git remote (already lost in brainstorm), Hindsight retain, knowledge-base pages.

