---
date: 2026-09-19
domains: [extensions, observability, testing]
topics: [buck-loop, sdk-streaming, activity-widget, complexity]
subject: 2026-09-18.buck-loop-extension
artifacts:
  - iterate-buck-loop-streaming-output.md
related:
  - buck-loop-live-feedback-2026-09-18.md
priority: high
status: completed
---

# buck-loop nested LLM output viewport

`/buck-loop` now streams nested work-session and closed-set choice SDK events into the existing activity widget. Nested `createAgentSession()` output is not a parent `renderCall`/`renderResult` surface; it comes from `AgentSession.subscribe()` plus `normalizeActivityEvent()`.

The command owns a six-row viewport (`maxActivityLines: 6`, `maxLineWidth: 64`). Wrapped text is capped while coalescing so a large delta cannot grow `pendingLines` without bound. `coalesceText` was split (`normalizeTextDelta` / `wrapFragment` / `trimOldest`) after lizard flagged it as a new complexity-12 hotspot.

## Evidence

- Focused suite: 84 tests across 5 files.
- Guardrails durable v2: `status: pass` (unit pass, complexity pass, global ratchet 81.4 > 79.4, patch advisory).
- Isolated OMP TUI smoke on `/tmp/omp-buck-loop-output-smoke` showed `buck-loop — Building phase-1-todo-cli.md` plus live assistant text and `▸ bash` / `✓ bash` rows.
