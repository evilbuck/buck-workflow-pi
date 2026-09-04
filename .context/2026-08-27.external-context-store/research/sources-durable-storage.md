---
status: active
date: 2026-08-27
subject: 2026-08-27.external-context-store
topics: [durable-storage, hindsight, vector-store]
---

# Sources: Durable storage

## Local skill — Hindsight HTTP API

- Path: `skills/hindsight-http-api/SKILL.md`
- Type: Official Documentation (local, environment-specific)
- Accessed: 2026-08-27
- Confidence: high for this machine's Hindsight wiring
- Quotes / data:
  - "Each retain runs fact extraction via LLM. ~13k input tokens per 4 items. Batch carefully — don't push raw chat dumps."
  - "Returns extracted facts with normalized tags, entities, `fact_type: world|experience`."
  - Recall: `POST /v1/default/banks/evilbuck/recall` — "semantic recall"
  - `MemoryItem` optional fields include `document_id`, `metadata`, `strategy`, `update_mode`

## Local skill — b-memory-import

- Path: `skills/b-memory-import/SKILL.md`, `skills/b-memory-import/scripts/import-context-memory.ts`
- Type: Source Code / Repository (this repo)
- Accessed: 2026-08-27
- Confidence: high
- Quotes / data:
  - "Push **this project's** `.context/{memory,backlog/items}/**/*.md` into the configured **Hindsight** bank via HTTP retain."
  - "Deterministic Bun script — no LLM, no qmd required" (client side); server still extracts.
  - `document_id` = `buck-ctx-mem:<slug>:<path-sha20>`; `update_mode: "replace"`; content cap ~48k chars.
  - Verification: "spot-check with OMP `recall`" — not file round-trip.

## Session record — two-layer memory

- Path: `.context/memory/omp-context-memory-hindsight-2026-08-14.md`; also `docs/oh-my-pi.md`, `docs/buck-workflow.md`
- Type: Official Documentation (project decision)
- Accessed: 2026-08-27
- Confidence: high
- Quotes / data:
  - "Do not replace `.context/memory` with LTM alone (git/PR/multi-harness)."
  - "b-memory-import is one-shot/backfill only, not every save."
  - Docs: Layer 1 `.context/memory` required; Layer 2 OMP LTM optional mirror.

## Live Hindsight `/version` (bilby)

- URL: `https://proxmox.tiger-goanna.ts.net:8888/version`
- Type: Official Documentation
- Accessed: 2026-08-27
- Confidence: high for this deployment
- Data: `api_version: 0.9.1`; features include `store_document_text: true`, `file_upload_api: true`, `document_export_api: true`, `document_import_api: true`, `mcp: true`, `worker: true`.

## Live Hindsight OpenAPI 0.9.1 (bilby)

- URL: `https://proxmox.tiger-goanna.ts.net:8888/openapi.json`
- Type: Official Documentation
- Accessed: 2026-08-27
- Confidence: high for this deployment
- Quotes / data:
  - `GET /documents/{document_id}`: "Get a specific document including its original text."
  - `DocumentResponse.original_text` required in schema but typed string|null; also `content_hash`, `tags`, `document_metadata`, `memory_unit_count`.
  - `GET /documents` "Documents are the source content from which memory units are extracted." Filter `q` = "Case-insensitive substring filter on document ID"; plus tags. No collection/snapshot field.
  - `MemoryItem.document_id`: "items sharing a document_id are grouped into the same document." `update_mode` replace deletes old data and reprocesses.
  - `POST /files/retain`: "Files stored in object storage (PostgreSQL by default, S3 for production)" then convert + extract facts.
  - Knowledge-base create page: "Content is generated asynchronously."
  - Knowledge-base search: "full-text (BM25) match and a vector-similarity match, Reciprocal-Rank-Fusion fused."

## GitHub repo search (failed to find upstream)

- Queries: `hindsight memory bank retain recall`, `hindsight HTTP API banks memories`
- Type: Source Code / Repository
- Accessed: 2026-08-27
- Confidence: low (search coverage)
- Result: no canonical Hindsight server repo found. Hits were third-party harness plugins (`dsh-hermes-bridge`, `dsh-hindsight-advanced`) that wrap retain/recall. Web search tool did not return usable results this session.
