---
status: completed
date: 2026-09-19
updated: 2026-09-19
subject: 2026-09-18.buck-loop-extension
topics: [iteration, buck-loop, sdk-streaming, tui, observability]
addresses: plan-buck-loop-extension.md
completed: 2026-09-19
memory:
  - buck-loop-streaming-output-2026-09-19.md
---

# Iterate: buck-loop nested LLM output

## Problem

`/buck-loop` shows its current phase and bounded activity widget, but nested SDK sessions do not feed assistant text or tool events into that widget. The command therefore proves it is alive without showing what the nested agent is doing.

## SDK finding

`renderCall` and `renderResult` customize rows for registered tool invocations in the parent message timeline. They do not render output from a nested `createAgentSession()` call made inside a slash-command handler.

Nested session output is available through `AgentSession.subscribe()`. `message_update` carries `assistantMessageEvent` text deltas; `tool_execution_start`, `tool_execution_end`, retries, and `agent_end` can reuse the existing `normalizeActivityEvent()` bridge.

## Decision

Stream normalized events from both buck-loop SDK call paths—work sessions and closed-set choice sessions—into the existing activity widget. Configure `/buck-loop` as a bounded six-row activity viewport so new assistant/tool output pushes older rows out of view while the existing footer continues to show the active phase.

## Scope

- Thread one activity callback through the supervisor to `runStep()` and `choose()`.
- Subscribe before each nested prompt and unsubscribe before session disposal.
- Reuse the existing event normalizer and activity sanitizer; do not add a second rendering path.
- Keep `renderCall` / `renderResult` unchanged because buck-loop is a command, not an LLM-callable tool.
- Preserve structured failure handoff and terminal cleanup.

## Acceptance

- Live assistant deltas from nested work sessions reach the buck-loop widget.
- Tool start/end and retry events remain visible through the same stream.
- Closed-set choice session output uses the same callback.
- The widget retains only the latest six activity rows, plus its existing heading.
- Event subscriptions are removed even when prompt execution fails.

## Evidence

- `run-step.ts` subscribes before `prompt()` and unsubscribes in `finally`.
- `choice.ts` forwards `onActivity` into `runOmpModelSession`.
- Isolated OMP TUI smoke showed live assistant text plus `▸ bash` / `✓ bash` under `buck-loop — Building phase-1-todo-cli.md`.
- Focused suite: 84 tests. Guardrails durable v2 passed after splitting `coalesceText` and capping pending wrap rows.
