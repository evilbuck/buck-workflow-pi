---
type: grill-session
date: 2026-08-27
subject: 2026-08-27.external-context-store
total_questions: 5
assessment_threshold: 20
boundary_assessment: cohesive
break_points: []
decision_domains:
  - name: Collection Model
    questions: [1-2]
    resolved: 2
    deferred: 0
  - name: Durable Storage
    questions: [3]
    resolved: 1
    deferred: 0
  - name: Access
    questions: [4]
    resolved: 1
    deferred: 0
  - name: Pointer File
    questions: [5]
    resolved: 0
    deferred: 0
status: active
related:
  - brainstorm-external-context-store.md
  - research-durable-storage.md

# Grill Session: External Context Store

Plan under grill: [brainstorm-external-context-store.md](brainstorm-external-context-store.md)

## Codebase-resolved (not asked)

- **Hydrate location → gitignored worktree `.context/`**. `scanContextDir` / `listSubjectFolders` / `writeIndexes` all `join(root, ".context")`. Subject-resolution and every `b-*` skill read that tree. An XDG cache would require a shim through the whole skill surface and would violate “existing `b-*` skills keep working unchanged.” “Not one static directory” is satisfied by the DB as source of truth; the worktree tree is a per-checkout cache, not a machine-bound store. Accidental `git add` remains a real risk — later domain.

## Decision Domains

### Domain: Collection Model
- Q1: What is a collection? → resolved: a unique `collection_id` naming a bag of artifact rows in the DB. Pointer file is `.context/collections.csv` listing those ids (not one CSV row per file). Artifacts themselves are DB rows with a `collection_id` field.
- Q2: How do artifacts inside a living collection stay ancestry-scoped? → resolved: they don't, inside the DB. Collections are living bags. The agent must call the hydrate tool with only the `collection_id`s in `HEAD`'s CSV — never "list all." Intra-collection latest-wins: new rows on an already-merged collection_id are visible to every hydrate of that id. Snapshots not required for v1.

### Domain: Durable Storage
- Q3: Vector store / Hindsight vs KV table as payload SoT? → resolved: **KV table**. User 2026-08-27: “a KV table might fit the bill… lock it in for now.” Host product deferred. Hindsight remains LTM mirror only. Evidence: [research-durable-storage.md](research-durable-storage.md).

### Domain: Access
- Q4: Who may read the KV table? → resolved: anyone with DB credentials. Auth deferred. Limiting which collections are in play is the model's tool call, not DB RLS.

### Domain: Pointer File
- Q5: Where does the committed pointer file live? → pending
## Boundary Assessment

Not yet at threshold (20).

## Deferred Questions

- KV host (Turso / Postgres / S3) — user will dig later; shape locked.
- Auth / teammate tokens — deferred explicitly.
