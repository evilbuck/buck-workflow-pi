---
title: Jev halt becomes a diagnosing transition
status: completed
date: 2026-10-16
memory: [buck-loop-jev-halt-iterate-2026-10-16.md]
iterations: [iterate-buck-loop-jev-halt-diagnose.md]
---

# Jev halt becomes a diagnosing transition

A guarded halt that Jev classifies as heavy no longer stops the operator. It is an optional machine edge to `diagnosing`.

## Decision

- Light and medium lifts still retry the same skill once.
- Heavy, including an illegal lift answer, stamps `repairLift: "heavy"` and takes `diagnosing` when the origin is building, iterating, documenting, or saving and `diagnoseAttempts` is 0.
- The diagnose session is told to fix the store the scanner reads. Completing the phase file is not proof when the scanner reads another adapter.
- One attempt. A miss blocks with `diagnose did not land the scanner proof`. Resume of that block does not rebuild.
- Resume of an existing `heavy lift:` block enters `diagnosing` instead of resolving into another build.
- Commit-checkpoint repair, loop limits, missing plans, scan defects, and extension restarts stay blocked. A missing checkpoint is never invented.

## Verification

`extensions/buck-loop/__tests__/machine.test.ts`, `loop.test.ts`, and `persist.test.ts` cover the edge, a landed proof continuing to review, and a heavy-lift resume that does not call `b-build`.
