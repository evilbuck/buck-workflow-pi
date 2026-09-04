---
status: draft
date: 2026-08-27
subject: 2026-08-27.external-context-store
---

# Subject: External Context Store

Branch-scoped, machine-portable store for Buck `.context` artifacts that cannot live in the repo. Intake via `/b-brainstorm`.

## Artifacts

- [brainstorm-external-context-store.md](brainstorm-external-context-store.md) — Initial brainstorm draft
- [grill-session-external-context-store.md](grill-session-external-context-store.md) — Grill session (active; Q1–Q4 resolved)
- [research-durable-storage.md](research-durable-storage.md) — Canonical: Hindsight/vector store is not enough as SoT
- [research/notes-durable-storage.md](research/notes-durable-storage.md) — Rolling notes
- [research/sources-durable-storage.md](research/sources-durable-storage.md) — Source log

## Status

Draft — living bags + agent-filtered hydrate locked; auth and KV host deferred.

## Summary

CSV at `HEAD` lists `collection_id`s. Agent tool fetches only those ids from a KV table (living bags). DB has no auth/ancestry. Hindsight is search-only.
