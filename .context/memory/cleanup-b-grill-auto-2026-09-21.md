---
date: 2026-09-21
domains: [extensions, skills, cleanup, docs]
topics: [b-grill-auto, grill, deprecation]
related: []
priority: medium
status: completed
subject: null
artifacts: []
---

# Dead b-grill-auto cleanup

Deleted unwired `extensions/b-grill-auto/` and skill `skills/b-grill-auto/` (including `grill.py`). Auto grilling remains `/skill:b-grill --mode auto` (`skills/b-grill/` already owns `grill.py`).

Living-doc cutover: `README.md`, `docs/buck-workflow.md`, `docs/extension-loading.md`, `docs/brainstorms/b-orchestration-extension.md`, Codex plugin copy of `b-grill`. AGENTS.md and GLOBAL_OR_PROJECT-AGENTS.md had no remaining mentions. Dropped the `buildSessionBody` complexity inventory row. Neutralized the save-apply index fixture. Archived the live-Pi-session backlog item.

Historical `.context/**` subject/plan/memory records and generated `presentations/` snapshots were left as record.

Guardrails: durable pass. Coverage ratchet unchanged at 84. Complexity inventory 33 → 32.
