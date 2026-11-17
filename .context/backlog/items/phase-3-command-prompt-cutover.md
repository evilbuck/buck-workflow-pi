---
title: "Phase 3: Command & Prompt Entrypoints and Extension Cutover"
status: completed
priority: medium
created: 2026-11-17
updated: 2026-11-17
completed: 2026-11-17
related: [.context/2026-11-16.omp-eval-loop-research/phase-3-command-prompt-cutover.md, .context/2026-11-16.omp-eval-loop-research/plan-omp-eval-loop-phases.md]
---

# Phase 3: Command & Prompt Entrypoints and Extension Cutover

Expose `/b-loop` prompt and command wrappers running `%load skills/b-loop/scripts/eval-buck-loop.ts` and unwire `wireBuckLoop(pi)` in `extensions/index.ts`.

Details and acceptance criteria: [phase-3-command-prompt-cutover.md](../../.context/2026-11-16.omp-eval-loop-research/phase-3-command-prompt-cutover.md). Difficulty: easy, `/b-build`.
