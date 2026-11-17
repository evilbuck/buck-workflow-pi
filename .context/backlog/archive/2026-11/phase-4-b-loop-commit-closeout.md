---
title: "Phase 4: b-loop Scoped Git Staging, Tree-Pinning Commit & Closeout"
status: completed
priority: high
created: 2026-11-17
updated: 2026-11-17
completed: 2026-11-17
related: [.context/2026-11-17.b-loop-repair/phase-4-git-commit-and-closeout.md, .context/2026-11-17.b-loop-repair/review-phase-4-git-commit-and-closeout.md, .context/2026-11-17.b-loop-repair/plan-b-loop-repair-phases.md]
---

# Phase 4: Scoped Git Staging, Tree-Pinning Commit & Closeout

Enforce fail-closed Git probes, clean/scoped staging with baseline `HEAD` + `write-tree` pinning, crash-safe commit adoption, final-phase `close-verified` folding, and strict verified `done` derivation.

Details and acceptance criteria: [phase-4-git-commit-and-closeout.md](../../2026-11-17.b-loop-repair/phase-4-git-commit-and-closeout.md). Difficulty: hard, `/b-build-hard`.

Completed: verified via `git-commit.test.ts` (10/10), `eval-buck-loop.test.ts` (13/13 including OMP A-4 2-phase end-to-end), `lizard -C 10 -w` (0 warnings), `tsc --noEmit` (0 errors in `skills/b-loop/`), and `npm run guardrails:check` (`88.3%` coverage, `complexity_gate: "pass"`).
