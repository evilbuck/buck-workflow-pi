---
title: Deterministic subject lifecycle and plan-scoped scan
status: completed
priority: high
created: 2026-09-19
updated: 2026-09-19
completed: 2026-09-19
related:
  - .context/2026-09-19.subject-work-state/plan-subject-work-state.md
  - extensions/buck-loop/scan.ts
  - skills/_shared/scripts/subject-lifecycle.ts
  - skills/_shared/scripts/context-helpers.ts
  - skills/_shared/subject-resolution.md
  - skills/b-save/SKILL.md
  - prompts/b-save.md
  - skills/b-save-improved/scripts/save-apply.ts
  - extensions/b-save-improved/index.ts
  - extensions/b-save-improved/__tests__/handler.test.ts
  - extensions/plan-artifact.ts
  - extensions/code-review-iteration/report.ts
  - plugins/buck-workflow/skills/_shared/scripts/subject-lifecycle.ts
  - package.json
  - .github/workflows/test.yml
  - .context/2026-09-19.subject-work-state/research-buck-loop-build-timeout.md
  - extensions/buck-loop/run-step.ts
---

# Deterministic subject lifecycle and plan-scoped scan

Stops `/buck-loop` reporting `done: all phases completed` for a new plan beside a finished epic, stops `b-plan` reusing a verified-closed subject, and removes direct subject-lifecycle writes from skills, prompts, extensions, and the physical Codex bundle.

Pickup: `.context/2026-09-19.subject-work-state/plan-subject-work-state.md`

Contract: plan-scoped `scan` plus one TypeScript intent authority (`initialize`, `activate`, `close-verified`, `reopen`). Active `/b-save` owns current closeout; `b-save-improved`, plan-artifact, and code-review report paths use the same authority. A dedicated PR policy audit blocks direct writers, and the existing Codex bundle parity test keeps its byte-identical distribution copy synchronized.

## Completion

Completed 2026-09-19. Final review passed with no in-plan or out-of-plan findings. Plan-scoped scan, canonical lifecycle intents, caller cutover, Codex parity, policy audit, and guardrails are verified.
