---
status: completed
phase: 3
order: 3
plan: plan-sql-memory-turn-hook.md
phases_overview: plan-sql-memory-turn-hook-phases.md
difficulty: hard
model_hint: Strong reasoning; OMP lifecycle integration, lazy imports, and package discovery.
buck_hint: /b-build-hard
goal: Load the automatic SQL memory observer safely as an OMP package hook.
omp_execution: none
files: [hooks/post/turn-memory.ts, package.json]
from_plan_steps: [4, 5]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] Hook observes session_start and agent_end only, skips willContinue, and does not initiate turns."
  - "[x] Loading with SQL_MEMORY_URL unset does not load pg; writer import is lazy and enabled-path behavior delegates to capture."
  - "[x] Package includes hooks and OMP lists the hook exactly once."
completed_at: 2026-10-08
completed_by: null
---

# Phase 3: OMP Hook and Package Surface

## Context

The person running OMP gets durable session facts saved to SQL memory without a manual `/b-save`; capture is on when SQL is configured, with an opt-out. This phase adapts the tested capture boundary to OMP lifecycle events and ensures published package discovery.

## Implementation Details

Add the direct `.ts` package hook factory under `hooks/post/`. Restore state from custom entries, register session status notification and `agent_end`, import the SQL writer only after enablement, and add `hooks` to package files. Do not register it a second time in `extensions/index.ts`.

## Risks

A hook loaded in downstream projects must resolve settings from `ctx.cwd`; never rely only on this checkout's settings. Avoid loading `pg` when disabled or unconfigured.

## Verification

Run hook tests and an import smoke with SQL_MEMORY_URL unset, checking the module graph does not include pg. Verify hook discovery through an OMP package surface smoke when available.
