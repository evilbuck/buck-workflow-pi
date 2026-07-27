---
title: b-init-guardrails — language-agnostic quality guardrails with brownfield ratchet
status: completed
priority: high
created: 2026-07-26
updated: 2026-07-26
completed: 2026-07-26
related:
  - .context/2026-07-26.b-init-guardrails/plan-b-init-guardrails.md
  - .context/2026-07-26.b-init-guardrails/index.md
  - skills/b-create-styleguide/SKILL.md
  - skills/code-smells/SKILL.md
  - docs/buck-workflow.md
---

# b-init-guardrails

Two new skills establishing quality guardrails — tests, coverage, cyclomatic complexity — in any
project, language- and framework-agnostic, preferring tooling the project already uses.

- **`b-init-guardrails`** — idempotent init: detect stack → measure baseline → propose → write
  `guardrails.json` → wire a managed `AGENTS.md` block.
- **`b-guardrails-check`** — the measurement contract. Dispatched as a background subagent on OMP so
  the mainline agent is never blocked; checkpoint-blocking on other harnesses. Measures, never edits.

## Why

Brownfield repos cannot adopt a single global threshold — it either fails on day one or enforces
nothing. The plan adopts the **two-gate model** (hard patch gate on changed lines + monotonic global
ratchet from the measured baseline) that PHPStan, Psalm, betterer, and Codecov patch all converge on.

## Status

Phased into 5 phases and built. All 5 phases complete. Three review-iteration passes closed all
in-plan defects:
- Pass 1: registration paths, ratchet ownership, baseline-aware complexity, recursive detection,
  lizard threshold, docs anchors, install guidance.
- Pass 2: managed-block dispatch ownership (caller owns OMP async `task` dispatch; check skill never
  self-dispatches); init skill verification bullet corrected to Phase 2.
- Pass 3: two behavioral defects found by live scratch-repo execution — `lizard` complexity command
  now excludes `node_modules`/`vendor`/`coverage`/`build` (was dumping thousands of vendored rows into
  the baseline); `diff-cover` patch gate now resolves a real `git_compare_branch` instead of
  hard-coding `origin/main` (was crashing on any repo without that exact remote/branch, including this
  one). Also added `configured_not_installed` surfacing for manifest-declared-but-missing tools.

`/b-review` passed clean after pass 3.

## Acceptance

Verification is behavioral, not documentary. Live-verified: brownfield repo does not fail on day
one; ratchet demonstrated asymmetric in both directions (coverage improve → baseline raises;
regress → fails, baseline unchanged); patch gate fails an uncovered new function while the global
baseline still passes; OMP async `task` dispatch shown non-blocking (continued other work while a
background verdict job ran, verdict auto-delivered); managed-block refresh is idempotent (no
duplication, hand-authored content survives).
