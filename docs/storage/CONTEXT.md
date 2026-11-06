# Durable Storage

This context names how Buck workflow knowledge stays branch-private until a proven publication, and how retained private state is recovered without treating a Git name or a code merge as authority.

## Language

**Sealed Checkpoint**:
The frozen set of immutable artifact revisions and their hashes for one source commit.
_Avoid_: Git commit, draft snapshot, merged flag

**Integration Ref**:
The project's configured full Git ref whose current local tip is the publication target.
_Avoid_: implicit main, fetched origin, default branch

**Integration View**:
The versioned set of artifact revisions proven published at the **Integration Ref** tip.
_Avoid_: merged=true, branch list, publication pointer

**Rewrite Mapping**:
An explicit attestation that one **Sealed Checkpoint**'s exact revision set is a rewritten integration commit.
_Avoid_: patch-id, squash inference, patch equivalence

**Publication Conflict**:
Two or more independently published revisions of one logical artifact, with the last unambiguous baseline retained.
_Avoid_: Git merge conflict, silent overwrite

**Orphan Scope**:
Retained private branch or workspace state that is no longer the current named incarnation.
_Avoid_: deleted data, lost branch, name match

**Scope Token**:
The operator handle that selects exactly one **Orphan Scope**.
_Avoid_: branch name, recycled ref

**Migration Snapshot**:
A versioned private inventory of one project's retained revisions, links, and provenance.
_Avoid_: current view, Git commit, stdout dump

**Legacy Quarantine**:
Original records kept privately because they lack exact branch or publication evidence.
_Avoid_: guessed import, published legacy, deleted history

**Backend Cutover**:
An offline verified switch of one project's storage selection that leaves the source intact.
_Avoid_: dual-write, env adoption, online migration

**Rescue Snapshot**:
The destination inventory retained before a cutover returns to its verified source.
_Avoid_: source deletion, overwrite rollback

## Relationships

- A **Sealed Checkpoint** enters the **Integration View** only when its bound commit is an ancestor of the **Integration Ref** tip, or a **Rewrite Mapping** attests that exact snapshot
- An **Integration View** keeps one selected revision per logical artifact unless a **Publication Conflict** is open
- A **Publication Conflict** keeps the last unambiguous baseline until an explicit resolution selects one candidate from that exact set
- An **Orphan Scope** is addressed by one **Scope Token**; deletion, rename, and same-name recreation do not publish it or hand it to a new incarnation
- Run projections, receipts, import cursors, pass audits, and attribution are not members of an **Integration View**
- A **Backend Cutover** installs one **Migration Snapshot** into an empty destination, then switches that project's config
- A **Legacy Quarantine** is not a member of an **Integration View**
- A **Rescue Snapshot** is a **Migration Snapshot** of the destination and is imported only into an empty project destination

## Example dialogue

> **Dev:** "The branch merged. Is the unsealed edit in the **Integration View**?"
> **Domain expert:** "No. Only the **Sealed Checkpoint** is published, and only if its bound commit is an ancestor of the **Integration Ref** or a **Rewrite Mapping** attests that exact set. A code revert does not remove that knowledge, and a **Publication Conflict** stays open until someone selects a candidate."
> **Dev:** "Can we dual-write while agents keep running, and let `SQL_MEMORY_URL` pick Postgres?"
> **Domain expert:** "No. A **Backend Cutover** is offline. The env var is not a backend. Ambiguous legacy rows stay in **Legacy Quarantine**, and rollback keeps a **Rescue Snapshot** instead of deleting the source."

## Flagged ambiguities

- "merged" was used to mean published — resolved: Git ancestry publishes a **Sealed Checkpoint** or a **Rewrite Mapping**, not unsealed checkout bytes.
- "revert" was used to mean delete knowledge — resolved: reverting code does not remove a still-reachable published revision; removal is an explicit artifact correction.
- "recover" was used for both a blocked loop and retained private storage — resolved: an **Orphan Scope** is selected by **Scope Token**; blocked-loop recovery is a separate operator procedure.
- "migrate" was used for both schema administration and a storage switch — resolved: schema administration stays `migrate`; a storage switch is a **Backend Cutover**.
- "export" was used for both orphan recovery and project migration — resolved: an **Orphan Scope** uses a **Scope Token**; a **Migration Snapshot** is the cutover inventory.
