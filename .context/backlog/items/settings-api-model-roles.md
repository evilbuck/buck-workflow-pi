---
title: "Replace modelRoles YAML parser with omp Settings API"
status: active
priority: medium
created: 2026-09-19
updated: 2026-09-19
completed: null
related:
  - .context/2026-09-19.settings-api-model-roles/plan-settings-api-model-roles.md
  - extensions/omp-models.ts
  - package.json
---

# Replace modelRoles YAML parser with omp Settings API

Swap the hand-rolled `config.yml` regex parser in `extensions/omp-models.ts` for `Settings.loadReadOnly()` from `@oh-my-pi/pi-coding-agent` (hard dep: optional peer + devDependency), delete the parser and the legacy `.pi/settings.json` `buckModelMapping` fallback, and migrate all callers (buck-loop, code-review-iteration, b-save-improved, buck-mode) to the async resolution API.

User-approved scope (2026-09-19): hard dep + parser deletion; legacy mapping retired. In-app role *writing* is explicitly out of scope (future plan).

Execution-ready non-phased plan: `.context/2026-09-19.settings-api-model-roles/plan-settings-api-model-roles.md`
