---
date: 2026-05-17
domains: [research, extensions, implementation, review, architecture]
topics: [subject-detection, phase-progress, b-flow, before_agent_start, hook, token-savings]
subject: 2026-05-17.subject-phase-detection
artifacts: [research-subject-phase-detection.md, presentation/index.html]
related: []
priority: medium
status: completed
---

## Context

User wanted to programmatically detect in-progress buck-workflow subjects and phase progress via pi extensions — initially for multi-project awareness, then scoped down to single-project token optimization. The real problem: every session resume burns ~3k tokens on discovery (scanning .context/, reading plans/phases/tasks to figure out what's next).

## Decisions Made

1. **Hook-based injection over filesystem scanning** — Instead of building a new multi-project dashboard extension, add a `before_agent_start` hook to existing `b-flow/index.ts` that reads `orchestration.json` directly and injects the next work item into LLM context. Zero tool calls, zero tokens for discovery.

2. **`/b-next` command** — Companion command for manual inspection without LLM involvement. Shows next queue item in TUI.

3. **Guards: idle state + missing file** — Hook skips when `currentState === "idle"` (fresh starts handled by XState scan) and when the next item's file doesn't exist (queue rebuilds automatically).

4. **display: false** — Injected message is LLM-only, hidden from TUI. Clean chat, full context.

## Implementation Notes

**File changed:** `extensions/b-flow/index.ts` (+86 lines, 2 new imports: `existsSync`, `readFileSync` from `node:fs`; `basename` from `node:path`)

**Hook logic:**
- Reads `orchestration.json` via `readProjection(projectRoot)`
- Finds first `in-progress` or `pending` queue item
- Reads 4KB snippet of the file content
- Builds queue status block (✓/▶/⚠/○ per item)
- Injects as hidden `CustomMessageEntry` with `customType: "b-workflow-next"`

**Token savings:** ~3,000 input tokens per session resume (5+ tool calls eliminated: ls, read plan, read phases, read tasks, reasoning about state).

**Tests:** All 88 pass. 2 pre-existing empty test files noted but unrelated.

## Verification

- Hook return signature matches Pi docs (`{ message: { customType, content, display } }`)
- `before_agent_start` fires once per user prompt (not per tool turn)
- `projectRoot` set by `session_start` before hook fires
- No actor dependency — reads disk directly (works when actor is null)
- `readFileSync` in async handler — negligible (4KB)
- Guards for idle, missing file, read errors
- No regressions to existing hooks (`session_start`, `session_before_compact`)
- b-review passed with 2 minor warnings (message accumulation over long sessions, pre-existing unused import)

## Next Steps

None — work is complete. Hook is live in `b-flow/index.ts`. Future optimization: only inject when `nextItem.id` changed from last injection (avoids repeated ~4KB message accumulation over long sessions).
