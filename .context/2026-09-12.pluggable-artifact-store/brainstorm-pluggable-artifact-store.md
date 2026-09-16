---
status: draft
date: 2026-09-12
subject: 2026-09-12.pluggable-artifact-store
topics: [context, artifacts, symlink, gitignore, synced-directory, adapters]
---

# Plan: Pluggable Artifact Store

## User Goal

Buckley keeps Buck plans, research, brainstorms, backlog, and session memory available on every machine, even when a project gitignores `.context/`. Teammate access is a later, optional extra — not a v1 requirement.

## What we might build

- **Two modes.** (1) **In-repo** — if `.context/` already exists as a real directory, leave it; skills behave as today. (2) **External** — if `.context/` is gitignored and missing, auto-ensure a symlink to `~/.local/share/buck/projects/<git-remote-slug>/`. No migrate. No rewriting an existing tree.
- **v1 skills unchanged** except a shared auto-ensure that only fires when `.context/` is absent *and* the project has opted into external (gitignore). They never mkdir a real `.context/` in external mode, and they never replace a real directory with a symlink.
- **Same layout** as today: `YYYY-MM-DD.subject/`, `memory/`, `backlog/`. Worktrees in external mode share one XDG store (same git remote → same path).
- **Later (not v1):** Bun `ArtifactStore` adapters (sqlite, postgres, GitHub issues) and semantic search. Needed only when the SoT is *not* a filesystem tree. Hindsight stays LTM fact-mirror — never the artifact store.

Sketch:

```text
repo/.context  ->  ~/.local/share/buck/projects/<git-remote-slug>/
repo/.gitignore  contains  .context/
```
## Why it matters

- Repos that ban or gitignore `.context/` currently drop plans and memory at the machine boundary.
- The Aug 27 hydrate design (CSV pointer + KV) solved team git-ancestry without a symlink. This v1 is the solo path: one directory, many machines, skills unchanged.
- A markdown tree in a synced dir stays greppable and portable via whatever already syncs the home directory (Syncthing, iCloud, a private git repo of the store).

## Constraints / preferences

- Solo across machines first; teammates later and optional.
- **One store.** Read and write use the same adapter. No split “write sqlite / read GitHub.”
- **SoT is always a markdown tree.** In-repo mode: project `.context/`. External mode: the XDG dir behind the symlink. Same layout either way.
- **v1 skills unchanged** except shared auto-ensure for *missing + gitignored* `.context/`. Never convert a real directory into a symlink. Bun API deferred until a non-`fs` backend exists.
- Payload for external-mode projects is not in the project git tree. **Committed surface = `.gitignore` line only** (that line *is* the opt-in). No v1 config file. No migrate command.
- Hindsight / vector DBs are not the artifact SoT (locked 2026-08-27 on the sibling subject). Search can index the store later.
- Stay inside Buck workflow — host repos should not have to adopt Buck beyond a `.gitignore` line if they want the external store; everyone else keeps committing `.context/` as they do now.

## Ideas considered (and why they sit where they sit)

| Idea | Role |
|---|---|
| **Symlink `.context/` → XDG dir + gitignore** | **v1 external mode.** Opt-in via gitignore. Skills unchanged. |
| **Synced markdown dir (XDG)** | The symlink target. Boring, diffable, Syncthing-friendly. |
| **Bun `ArtifactStore` + `fs` adapter** | Deferred. The seam for sqlite/postgres/GH later — not required while SoT is files. |
| **SQLite (+ later sqlite-vec)** | Same-machine only unless we sync the file. Future replacement + semantic search home. |
| **Postgres / Turso / D1** | Teammate / multi-machine without file sync. Adapter later. |
| **GitHub issues** | Wrong grain for a subject folder. Later adapter, not a layout. |
| **Aug 27 CSV pointer + KV hydrate** | Team git-ancestry visibility. Related, not this v1. |
| **API-now + remap fallback** | Earlier interview pick (Q4). Superseded for v1 by symlink; keep as the *later* backend story. |
| **Independent read vs write adapters** | Rejected. One store. |
| **Daemon / local HTTP** | Unnecessary for `fs`. |
## Open questions

- **No git remote:** clone-path hash is machine-specific and will **not** meet across machines. Bare repos, `origin` missing, or multiple remotes — what slug?
- **Gitignore auto-add:** auto-ensure of the symlink without the ignore line can commit the symlink (leaks the home path). External mode assumes the line is already committed (it’s the opt-in). Warn vs fail if missing `.context/` and *not* gitignored — today’s mkdir-in-repo path?
- **Who syncs `~/.local/share/buck/`:** document “put this in your sync folder” vs assume home sync vs a private git repo of the store.
- **Remote slug algorithm:** `origin` URL as-is, normalized (strip `.git`, user, protocol), or hash? Must be stable when GitHub user/org rename or SSH vs HTTPS.
- **Relationship to `2026-08-27.external-context-store`:** symlink = solo; hydrate+CSV = team pointer. Coexist?
- **Semantic search host (later):** sqlite-vec beside the files, local embeddings index, or Hindsight as search-only mirror.

## Brainstorm notes

- Q1: just Buckley across machines; teammates maybe later.
- Q2: v1 SoT = synced directory (not SQLite/Postgres/GitHub).
- Q3: one store; TS is a facade; other backends later as replacements.
- Q4: API now + remap fallback. **Pivoted:** v1 = symlink + gitignore; adapters later.
- Q5: machine 2 = convention + auto-ensure when `.context/` is missing; gitignore is the committed opt-in.
- **Migrate dropped:** existing real `.context/` stays in-repo. Dual-mode. No one-time migrate.
- Sibling subject `2026-08-27.external-context-store` locked KV bags + CSV-at-HEAD for team git-ancestry; this intake is the solo synced-dir thesis.
