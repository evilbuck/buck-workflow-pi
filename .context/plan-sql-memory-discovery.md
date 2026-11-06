---
status: completed
date: 2026-09-29
research: []
memory: [../memory/sql-memory-discovery-2026-09-29.md]
---

# Always-loaded SQL memory discovery

## User Goal

Introduce `sql_memory` in the global bootstrap so ordinary project work can recall useful prior knowledge without invoking a Buck skill first.

## Scope

- Add purpose, recall triggers, skip conditions, availability/fallback, and a resolvable installed-protocol pointer to the bootstrap.
- Align the shared recall protocol and its Codex mirror; preserve project identity and existing bounded SQL query.
- Reinforce the policy in the registered tool description and prompt snippet.
- Update SQL memory docs/how-to and changelog.
- Preserve supervisor-provided recall, stage permissions, and `/b-save` ownership of durable writes.
- Do not add a mandatory Jev pre-query gate or change loop routing, database schema, SQL execution, or save semantics.

## Verification

- Load the actual tool factory and inspect its agent-facing metadata without connecting to PostgreSQL.
- Check installed bootstrap/protocol resolution and canonical/Codex parity.
- Run relevant existing tests and the durable guardrails contract because tool metadata is TypeScript.
- Record results and prepare a task-scoped commit draft. Shared SQL/Jev devices are currently unmounted; file-mode context is the available durable save path. The git-commit skill prohibits automatic staging; changes remain unstaged.

## Acceptance criteria

- [x] Bootstrap exposes when and how to recall outside a loop.
- [x] Policy directs recall for explicit historical questions and skips redundant queries for self-contained tasks and already-supplied relevant recall.
- [x] Missing/failed tooling is not described as an empty store; retrieved facts do not override current instructions or evidence.
- [x] Agent-facing tool metadata reinforces the policy and all portable copies/docs agree.
- [x] Smoke checks, existing tests, and required guardrails pass.
