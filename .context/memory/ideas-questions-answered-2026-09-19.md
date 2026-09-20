---
date: 2026-09-19
domains: [research, docs, buck-loop]
topics: [advisor, telemetry, sdk-agent-interface, iterate-limit, progress-widget]
related: [research-buck-loop-idempotency.md]
priority: low
status: completed
subject: 2026-09-19.ideas-questions
artifacts: [docs/ideas.md]
---

# docs/ideas.md questions answered inline (2026-09-19)

All open questions in `docs/ideas.md` answered inline with file:line evidence (3 parallel scouts).
Skipped as already covered: Q4 (model routing) and Q7 (idempotency → chooser-stall plan).

Key findings:
- **Advisor (Q1):** not in Pi SDK 0.73.1; native in omp fork `src/advisor/` (WATCHDOG.yml configs, advise() tool with nit/concern/blocker severity). Copyable pattern: `AdvisorAgent {prompt, abort, reset, rollbackTo?, state.messages}` in runtime.ts.
- **Abstract interface (Q2):** buck-loop's session surface is just `{prompt, abort, subscribe, dispose?, messages}` + config opts; trivially abstractable.
- **Telemetry (Q3):** event stream + getSessionStats free; no OTEL/metrics/traces — self-wire on subscribe() boundaries.
- **Progress (Q5):** repeated `▸ edit` rows = renderer-level: 64-char target truncation collision, 6-line viewport, no coalescing (extension-activity.ts).
- **Iterate limit (Q8):** hard-coded cap 3 (table.ts:25); block touches only buck-loop.json projection; phase/plan files untouched; `--resume` currently re-blocks immediately (counter carried forward) — needs new flag + resumeRun bump + UX seam.

Docs-only session (docs/ideas.md + memory) — guardrails gate skipped.
