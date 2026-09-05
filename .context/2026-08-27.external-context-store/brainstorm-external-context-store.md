---
status: draft
date: 2026-08-27
subject: 2026-08-27.external-context-store
topics: [context, git, memory, portability, team-repos, pointers, database]
---

# Plan: External Context Store (pointer file + DB collections)

## User Goal

Buckley can run the normal Buck `.context` workflow (plans, memory, backlog, subject folders) on team repos that forbid committing a `.context/` tree. Any agent on a checkout where those commits are reachable from `HEAD` sees the same file-based `.context` they would if the files lived in-repo. Teammates who want in can get access; teammates who don't are not forced to take a payload, only a small committed pointer file.

## What we might build

- A **small committed pointer file** (CSV is the current lean) in the project repo.
- Each row is a `collection_id` (bag of artifact rows). Payload lives in a **KV table**, not Hindsight.
- An **agent tool** that:
  1. Reads `.context/collections.csv` at `HEAD`.
  2. Fetches **only those `collection_id`s** from the KV table (model must not list-all).
  3. Materializes a local, gitignored `.context/` so existing `b-*` skills keep working unchanged.
- DB does not enforce git ancestry or auth. Anyone with credentials can query any collection. Limiting is the tool call.

Sketch (not a schema):

```csv
collection_id,kind,path_hint
01J…,subject,2026-08-27.feature-foo
01K…,memory,memory/feature-foo-2026-08-27.md
```

`kind` / `path_hint` are so hydrate can rebuild the familiar layout. The git tree version of this file **is** the branch filter.

## Why it matters

- Team repos that ban or gitignore `.context/` currently lose Buck session memory, plans, and handoff between machines/worktrees.
- Putting the **index** in git (tiny, reviewable) and the **blobs** in a DB keeps history/merge/rebase behavior of files without dumping agent notes into the project tree.
- Unmerged work stays dark on other lines because those pointer rows are not in that tree. Merge onto `main` exposes them the same way merging `.context/` would today.
- Worktrees and other machines are not tied to one static directory: each checkout hydrates from the same DB using whatever pointer file that `HEAD` contains.

## Constraints / preferences

- Payload is **not** in the project tree. Pointer file **may** be committed (`.context/collections.csv` leaning).
- Not a single static directory on one machine.
- **Payload store (locked 2026-08-27):** KV table `(collection_id, path, content, sha256)` — living bags, no snapshot required for v1. Host product (Turso / Postgres / S3) deferred. Hindsight stays LTM search mirror only — never hydrate from recall. See [research-durable-storage.md](research-durable-storage.md).
- Visibility = **CSV at HEAD** (commit ancestry of the pointer file). Agent passes those ids into the tool. Reusing a `collection_id` after it is on `main` makes later rows visible on `main` (latest-wins).
- Agent UX = file-based `.context` after hydrate (gitignored worktree `.context/`; codebase-resolved).
- Primary user is Buckley; teammate access is opt-in, not viral. **Auth deferred.**
- Stay inside Buck workflow skills/tools — no requirement that the host repo adopt Buck beyond allowing the pointer file.

## Ideas considered (and why they lost)

- **Git notes**: no working-tree files, ancestry via annotated commits, teammates fetch a notes ref. Lost because rebase needs retarget, and the user preferred an explicit pointer + DB collections.
- **Side remote / sidecar repo keyed by SHA**: clean project git, extra remote to add. Lost because a committed pointer is acceptable and gives ancestry “for free” via the tree.
- **Pure DB + tool, no pointer**: agents would have to query “all collections for this repo” and then filter. Without a git-tree index, unmerged work leaks unless we reimplement ancestry in the DB. Pointer-in-git is the filter.
- **Hindsight / vector store as SoT**: retain extracts facts, recall ranks, no collection/snapshot API. Lost 2026-08-27 (research-durable-storage). Optional later: retain a short fact *after* snapshot.

## Open questions

- **KV host** (deferred): Turso/libSQL vs Postgres vs S3/MinIO. Shape is locked; product is not.
- **Pointer path/name**: `.context/collections.csv` is the lean; confirm teams will allow a file under `.context/` if they ban the rest of the tree.
- **CSV merge**: two branches adding rows → union-merge or conflict? Unique `collection_id` plus append-only rows would let git merge as a union; edits/deletes are harder.
- ~~**Hydrate location**~~ locked: gitignored worktree `.context/`.
- **Write path**: `b-save` / `b-plan` write local files then push collections + append pointer rows? Or write to DB first and generate the CSV? Who commits the pointer file — agent, hook, or human?
- ~~**Auth**~~ deferred: anyone with DB creds; model tool-call limits collections.
- **Large artifacts / binary**: keep markdown-only (current `.context`) or allow more.
- **Detached HEAD / rebase / cherry-pick**: pointer file follows the commit, which is what we want; confirm we do **not** also key rows by SHA inside the CSV (redundant, rebase-hostile).
- **This repo vs a generic Buck skill**: first consumer is team projects; shipping as a buck-workflow-pi skill/tool that any repo can adopt.

## Brainstorm notes

- Interview: for Buckley on team repos that ban `.context/`; teammates may opt in.
- “Act just like a file-based `.context` as long as it’s in a tree for that git branch.”
- Visibility key: commit ancestry, “just like it works now with `.context`.”
- Storage: small committed pointer (CSV ok) → collections in a database. Agent tool to resolve.
- Original “not one static directory / survive machines and worktrees” → DB is the center; each checkout hydrates.
- 2026-08-27: user locked KV table as payload SoT; will dig into host later. Hindsight is not the store. Living bags; agent filters by CSV ids; auth later.
