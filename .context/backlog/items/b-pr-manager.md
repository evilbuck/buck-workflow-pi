---
title: Build autonomous PR feedback manager
status: active
priority: high
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-10.b-pr-manager/plan-b-pr-manager.md
  - extensions/b-pr-manager/
---

# Build autonomous PR feedback manager

Implement `/b-pr-manager` as the narrow, resumable OMP state machine defined in the linked plan. It must validate all PR feedback, run bounded Buck fix/review loops, safely rebase and push, poll with decay, honor GitHub protections, enable auto-merge, and report success only after GitHub confirms the PR merged.

## Next action

Run `/skill:b-phase .context/2026-09-10.b-pr-manager/plan-b-pr-manager.md` before implementation.
