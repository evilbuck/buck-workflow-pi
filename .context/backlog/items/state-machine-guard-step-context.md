---
title: State-machine guards must attach context to the next step
status: active
priority: high
created: 2026-10-04
updated: 2026-10-04
completed: null
related:
  - extensions/state_machine/index.ts
  - extensions/buck-loop/machine.ts
  - extensions/buck-loop/loop.ts
---

# State-machine guards must attach context to the next step

## User Goal

A refused transition stays inside the graph and tells the next step why, instead of the supervisor inventing a second policy.

## Problem

This is not how the machine works today. A guard is `(facts) => boolean`. An effect is `(facts) => Effect` and only describes work; the caller runs it. `transition()` does not return prompt context for the step that runs instead.

The missing case is `building → reviewing` while acceptance criteria are still unchecked. The guard must refuse review and send another `b-build`, with the unfinished unchecked criteria in that build's prompt. Finished criteria stay checked. Unfinished criteria stay unchecked.

## Required contract

- A guard can refuse an edge and select the legal alternate edge.
- The refused edge's effect can carry context for that next step. The caller passes it through as the next skill handoff. The machine still does not perform the work.
- First consumer: open acceptance on `building → reviewing` becomes another build whose handoff names those unchecked lines.

## Pickup

Do not fake this in `loop.ts` with a side channel that the graph cannot see. Extend `extensions/state_machine/index.ts`, then use it from `extensions/buck-loop/machine.ts`.
