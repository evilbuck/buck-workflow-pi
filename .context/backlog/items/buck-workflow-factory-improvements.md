---
title: Harden Buck Workflow integrity and enforcement
status: active
priority: high
created: 2026-09-18
updated: 2026-09-18
completed: null
related:
  - .context/2026-09-18.good-ideas/plan-buck-workflow-factory-improvements.md
  - skills/b-guardrails-check/
  - scripts/install.mjs
  - scripts/codex-plugin.test.ts
  - scripts/security-audit.sh
---

# Harden Buck Workflow integrity and enforcement

Validate and implement the five Buck Workflow cross-pollination recommendations from the software-factory comparison without copying stale counts or breaking the self-contained Codex bundle.

Pickup: `.context/2026-09-18.good-ideas/plan-buck-workflow-factory-improvements.md`.

Dependency: coordinate command-mirror assertions with `.context/backlog/items/commands-mirror-drift.md` — consumed 2026-09-18 (all-symlink contract, zero exceptions; item archived).

Status 2026-09-18: implemented via `/b-build` (standard) — all 11 acceptance criteria met; `npm test` 737/737; `npm run guardrails:check` PASS (exit 0). Baseline events recorded in session memory: complexity re-baseline (8 pre-existing entries + parseArgs 66→68), coverage floor 79.4 (session net 54.9 → 79.4), guardrails `enforcement` cutover. Pending `/b-review` → `/b-docs` → `/b-save` → `/b-commit`; todo.md queue link deferred until its unrelated merge conflict is resolved.
