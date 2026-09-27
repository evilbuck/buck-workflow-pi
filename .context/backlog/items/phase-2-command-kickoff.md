---
title: "Phase 2: Command Boundary and Kickoff"
status: active
priority: medium
created: 2026-09-27
updated: 2026-09-27
completed: null
related:
  - .context/2026-09-19.buck-loop-subject-picker/phase-2-command-kickoff.md
  - .context/2026-09-19.buck-loop-subject-picker/plan-buck-loop-subject-picker-phases.md
  - extensions/buck-loop/index.ts
---

# Phase 2: Command Boundary and Kickoff

Wire the Phase 1 ranking module into `/buck-loop`: no-path start parsing, bounded `ui.select` (timeout + AbortSignal), exactly-one `handleLoop` kickoff, fail-closed cleanup. HARD-depends on Phase 1. Hard, `/b-build-hard`.

Pickup: [phase-2-command-kickoff.md](../2026-09-19.buck-loop-subject-picker/phase-2-command-kickoff.md)
