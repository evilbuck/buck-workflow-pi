---
status: active
date: 2026-08-27
subject: 2026-08-27.external-context-store
topics: [durable-storage, hindsight, vector-store, collections, sqlite, postgres]
informs:
  - brainstorm-external-context-store.md
  - grill-session-external-context-store.md
---

# Research: Durable storage for the external context store

## Question

Should collection payloads live in a vector store — specifically this environment's Hindsight DB — and would that be enough for pointer-CSV + hydrate?

## Verdict

**No.** A vector store is the wrong retrieval model for hydrate. Hindsight is a **memory system** (LLM fact extraction + semantic recall) that *also* keeps source `original_text` when `store_document_text` is on. That side channel is not enough to be the source of truth for `.context` files.

Keep Hindsight as today's Layer 2 search mirror. Put collection bytes in a **key-value / document table** keyed by `(collection_id, snapshot_id, path)`.

## What hydrate actually needs

| Need | Vector recall | Hindsight `GET /documents/{id}` | KV table |
|---|---|---|---|
| Exact markdown bytes | No (ranking) | Maybe (`original_text`, nullable) | Yes |
| Fetch collection/snapshot as a set | No | No first-class field; substring on `document_id` or tags | Yes |
| Git ancestry (unmerged dark) | No | No | CSV at HEAD is the filter; DB must not "latest wins" |
| Cost per write | Embed + query | LLM extract (~13k tokens / 4 items here) | Put row |
| Teammate opt-in without sharing personal memory | Bank-wide | Sharing `evilbuck` leaks LTM unless a dedicated bank | Separate DB or tokens |
| Existing `b-*` skills | N/A | N/A | Hydrate into gitignored `.context/` |

## Hindsight as it actually is (v0.9.1, this instance)

Not "just a vector DB." Live `/version` flags: `store_document_text`, file upload, document import/export.

Three layers inside one product:

1. **Memory units** — retain → extract facts → `recall` / `reflect` / graph. This is what `/b-save` step 8 and `b-memory-import` use.
2. **Documents** — source text grouped by `document_id`. `GET /documents/{id}` returns `original_text` + `content_hash`. List filter is id substring + tags. Retain with `update_mode: replace` **reprocesses** (extracts again).
3. **Knowledge-base pages** — LLM-generated markdown, hybrid BM25+vector search. Authoring is async generation, not "PUT this file."

`POST /files/retain` stores blobs in Postgres (default) or S3, then converts and extracts. That object store is not a collection API.

No public upstream repo was found this session; evidence is the deployed OpenAPI and this repo's client.

## Why "use Hindsight anyway" fails the plan

- **Extraction is the product.** Local skill: do not push raw dumps; every retain is an LLM pass. Plans and session markdown would pollute `evilbuck` world/experience facts.
- **Locked two-layer decision (2026-08-14):** `.context` is canonical; LTM must not replace it. Making Hindsight the payload SoT inverts that.
- **No collection/snapshot query.** We would smash ids into `document_id` (`buck-ctx:<collection>:<snapshot>:<path>`) and hope list-`q` works.
- **Ancestry is still the CSV.** Hindsight has no `HEAD`. A living document with `update_mode: replace` is the Q2 leak (main sees unmerged C).
- **Sharing.** Teammate opt-in via Hindsight credentials today means the personal bank, unless we mint a dedicated bank *and* still pay extraction.

Optional later: after hydrate, retain a *short* session fact ("subject X exists, snapshot Y") into Hindsight for recall. Never hydrate from recall.

## What is enough

A boring document store:

```
collection_id TEXT
snapshot_id   TEXT
path          TEXT   -- .context-relative
content       TEXT   -- exact markdown
sha256        TEXT
PRIMARY KEY (collection_id, snapshot_id, path)
```

Hosted so machines/worktrees are not one static directory: libSQL/Turso, a small Postgres DB, or S3/MinIO objects with the same key. CSV at `HEAD` lists which `(collection_id, snapshot_id)` exist on this line. Hydrate is `SELECT` those rows, write gitignored `.context/`.

Hindsight's Postgres is an implementation detail of the memory product. Do not reuse its tables.

## Confidence

- Hindsight-as-used-here (extract + recall, not SoT): **high** (skill, importer, 2026-08-14 decision, live OpenAPI).
- `original_text` round-trip fidelity on this instance: **medium** (schema allows null; not integration-tested this session).
- Skip-extraction retain strategy exists: **unknown** (bank `config` is an opaque object).
- Best hosted KV (Turso vs Postgres vs S3): **low** — landscape only; pick in grill/plan.

## Open questions (for grill / plan, not this research)

- Hosted KV product and who runs it.
- Dedicated Hindsight *bank* as a compromise (still not recommended as SoT).
- Whether to *also* retain summaries into Hindsight after each snapshot (search sugar, not storage).
