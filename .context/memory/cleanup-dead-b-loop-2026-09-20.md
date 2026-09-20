---
date: 2026-09-20
domains: [extensions, cleanup, guardrails, skills]
topics: [b-flow, xstate, buck-loop, b-loop, deprecation]
related: []
priority: medium
status: completed
subject: null
artifacts: []
---

# Dead b-loop extension cleanup

Deleted unwired XState `extensions/b-flow/` (the deferred pass from ADR 0002 / `plan-buck-loop-extension.md`). Dropped the `xstate` dependency.

`/buck-loop` remains the runner. `/skill:b-loop` was unused (no slash mirror, no callers) and was deleted. `b-plan` recommends `omp_execution`; `b-phase` writes it on new phase files. `extensions/b-grill-auto/`, `grill-me-dialog.ts`, and `tmux-window-status.ts` stay unwired.

Living docs cut over: `docs/b-flow.md`, `docs/buck-workflow.md`, `docs/extension-loading.md`, `docs/adr/0002`, `skills/_shared/subject-resolution.md` (+ Codex `_shared` copy). Backlog item archived.

Guardrails: durable pass. Coverage ratchet 79.2 → 84 after deleting under-covered dead code. Complexity inventory 37 → 33 (four `extensions/b-flow/*` hotspots gone).
