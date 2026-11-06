---
status: completed
date: 2026-05-15
subject: 2026-05-15.tps-tracker-review
topics: [review, iteration, extensions, tps-tracker]
from_review: b-review
---

# Iteration: TPS Tracker Review

## Source
- Reviewed after: user-created `extensions/tps-tracker.ts`
- Plan: none found; reviewed against user request and Pi extension/package docs
- Spec: none found

## Critical Issues

### 1. TPS tracker is not loaded by the package
- **File**: `package.json`, `extensions/index.ts`, `extensions/tps-tracker.ts`
- **Problem**: `package.json` declares only `./extensions/index.ts` under `pi.extensions`, and `extensions/index.ts` does not import or call `extensions/tps-tracker.ts`. Pi package docs say manifest extension paths are what get loaded. As written, the tracker only runs if invoked directly with `pi -e ./extensions/tps-tracker.ts`; it will not run for normal package installs/usages.
- **Proposed fix**: Either add `./extensions/tps-tracker.ts` to `package.json` `pi.extensions`, or wire it from `extensions/index.ts` by importing it and calling it with `pi` in the default extension factory.

## Warnings

### 1. Final-only/non-streaming responses can report misleading TPS
- **File**: `extensions/tps-tracker.ts`
- **Problem**: `message_end` falls back to `messageStart` when no output delta was observed. In Pi's agent loop, a final-only response can emit `message_start` immediately before `message_end`, making elapsed time near zero and TPS misleadingly high or `N/A`.
- **Suggested approach**: Treat messages with no `streamStart` as unmeasurable for streaming TPS, or show a separate non-streaming/final-only label instead of dividing by the fallback duration.

### 2. UI use is not gated for non-interactive modes
- **File**: `extensions/tps-tracker.ts`
- **Problem**: Pi docs recommend checking `ctx.hasUI` before using UI methods in non-interactive modes. The current calls likely no-op in print/json, but this should be explicit if the extension is expected to run everywhere.
- **Suggested approach**: Guard `ctx.ui.setStatus`/`ctx.ui.notify` with `if (!ctx.hasUI) return;` or centralize safe UI helpers.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. The smallest fix is to wire `tps-tracker.ts` into the package load path, then optionally add a small handler simulation test for the direct metrics behavior.
