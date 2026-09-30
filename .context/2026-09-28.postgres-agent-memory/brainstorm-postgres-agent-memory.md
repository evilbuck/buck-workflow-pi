# Plan: remote Postgres agent memory

## User Goal

Unconfirmed. Draft: a team of OMP users shares one remote Postgres memory store. Any engineer can search across projects, filter by project, user, and git branch, and see higher-ranked memories from stronger engineers ahead of weaker cross-team notes. Order and context stay attached.

## What we might build

- An OMP agent tool, registered like `jev`, that reads and writes a remote PostgreSQL schema.
- Shared memory across projects, with project, user, and branch filters.
- A stored author-skill weight plus a Jev value score. Retrieval multiplies them with recency and relevance.
- Raw episodes for context and order. Extracted facts for search. LLM summaries that Jev only triggers.
- Branch facts that close on merge instead of being deleted.
- One primary category from a seed taxonomy, plus many retrieval tags.
- Jev classifies into the active taxonomy. It does not invent label text. New categories are promoted from candidates.
- A `turn_end` hook that evaluates the completed turn and may write a memory. Explicit store and `/b-save` stay. The hook adds a path. It does not replace them.

## Why it matters

- Per-repo `.context/memory/` does not share across projects or users.
- Hindsight is already a remote store, but it does not rank by engineer skill or tie memories to a git branch.
- A less-skilled engineer's note should not outrank a stronger teammate's on the same topic.

## Constraints / preferences

- OMP first. Harness-agnostic skill later. The skill must not open Postgres.
- Own schema. Do not reuse Hindsight tables.
- Jev cannot write summaries, SQL, or new taxonomy labels.
- `.context/memory/` is the locked git-portable record unless explicitly overridden.
- v1 is Postgres plus pgvector. No graph database. No vector sidecar.

## Open questions

- Confirm the user goal, including whether Postgres replaces `.context/memory/` or sits beside it.
- Who assigns skill weight?
- Does merge promote a branch memory to the project, or only close it?
- Shared by default, or private until promoted?
- Are methodology, tool, and convention allowed to be global, while project facts must carry a project id?

## Brainstorm notes

- Scope is not exclusive. Branch memories still have a project id, or project search cannot see them.
- Write path: Jev chooses store, merge, or reject. SQL does the write.
- Recall path: SQL shortlist, then Jev `noul` per candidate. Do not send the whole table to Jev.
- Techniques not in the intake: bi-temporal close (`invalid_at`), episode/fact split, access decay, explicit merge promotion.
- Capture is additive: tool call, `/b-save`, and `turn_end`. Do not use `message_end` or memories will include tool-call chatter.
- Idempotency: session file plus entry id. Nested agent turns are not visible on the parent `turn_end`.
