---
date: 2026-05-18
domains: [debugging, extensions, plan-mode]
topics: [completeSimple, response.content, zai-provider, string-vs-array, plan-mode-bash-review]
subject: 2026-05-18.buck-loop
artifacts: [draft-commit.md]
related: [buck-loop-phase-5-6-review-save-2026-05-18.md]
priority: medium
status: completed
---

# Session: 2026-05-18 — Fix response.content.filter crash in plan-mode bash review

## Context
- Extension error: `msg.content.filter is not a function` in `extensions/index.ts` line 1004.
- Triggered when plan-mode AI bash review calls `completeSimple()` and the provider returns `content` as a plain string instead of a content-block array.
- Affects zai/GLM and potentially other OpenAI-compatible providers.

## Root Cause
`completeSimple()` returns `AssistantMessage` whose `content` type is `(TextContent | ThinkingContent | ToolCall)[]` per TypeScript, but at runtime some providers (zai) return `content` as a `string`. The code called `.filter()` on the string.

## Fix
Added `Array.isArray(response.content)` guard before filtering in both locations, with `String(response.content ?? "")` fallback for non-array responses.

### Changed Files
- `extensions/index.ts` — line 1004: defensive guard for `response.content` type in plan-mode AI bash review.
- `extensions/tmux-window-status.ts` — three fixes:
  - `extractTextBlocks()`: guard `msg.content` with `Array.isArray()` before iterating (was iterating string characters with `for...of`).
  - `message_end` logEvent: replaced inline `.filter().reduce()` chain with `extractTextBlocks(msg).length`.
  - Both `message_update` and `message_end` handlers call `extractTextBlocks()`, so both are now safe.

## Verification
- `npx tsc --noEmit` — no new TypeScript errors (pre-existing errors in unrelated files only).
