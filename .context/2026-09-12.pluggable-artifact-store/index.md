---
status: active
date: 2026-09-12
subject: 2026-09-12.pluggable-artifact-store
---

# Subject: Pluggable Artifact Store

Read/write adapters for Buck-loop artifacts (plans, research, brainstorms, backlog, memory) so projects that do not commit `.context/` still keep a durable per-project store. Intake via `/b-brainstorm`.

Related prior work: [2026-08-27.external-context-store](../2026-08-27.external-context-store/index.md) — pointer-file + KV hydrate (skills stay file-based). This subject explores changing skills to talk to a TypeScript store API instead.

## Artifacts

- [brainstorm-pluggable-artifact-store.md](brainstorm-pluggable-artifact-store.md) — First-draft intake
- [plan-pluggable-artifact-store.md](plan-pluggable-artifact-store.md) — v1 implementation plan (auto-ensure script, dual-mode table)
- [draft-commit.md](draft-commit.md) — Conventional commit draft

## Status

Active — implemented via `/b-build`. Opt-in gitignore line is `.context` (no trailing slash). Guardrails complexity gate still fails on pre-existing hotspots outside this diff.
