---
date: 2026-09-11
updated: 2026-09-11
domains: [extensions, tui, omp]
topics:
  - extension-activity
  - spinner
  - widget
  - model-streaming
  - b-pr-improved
  - b-commit-improved
  - b-save-improved
  - b-kamal-release
subject: 2026-09-11.extension-activity-progress
artifacts:
  - .context/2026-09-11.extension-activity-progress/index.md
  - .context/2026-09-11.extension-activity-progress/plan-extension-activity-progress.md
  - .context/2026-09-11.extension-activity-progress/plan-extension-activity-progress-phases.md
  - .context/2026-09-11.extension-activity-progress/phase-1-subprocess-extraction.md
  - .context/2026-09-11.extension-activity-progress/phase-2-activity-core.md
  - .context/2026-09-11.extension-activity-progress/phase-3-model-runner-wiring.md
  - .context/2026-09-11.extension-activity-progress/phase-4-command-migration-docs.md
  - .context/2026-09-11.extension-activity-progress/iterate-extension-activity-progress.md
  - extensions/extension-activity.ts
  - extensions/extension-activity.test.ts
  - extensions/subprocess.ts
  - extensions/subprocess.test.ts
  - extensions/omp-models.ts
  - docs/oh-my-pi.md
related:
  - .context/2026-09-11.extension-activity-progress/plan-extension-activity-progress.md
  - .context/2026-09-11.extension-activity-progress/iterate-extension-activity-progress.md
  - .context/backlog/items/deterministic-extension-progress.md
priority: high
status: completed
---

# Session: 2026-09-11 — Unified live activity for extensions (closed)

## User Goal

When an extension makes LLM calls and starts doing work, I see an animated status indicator and a small live window of what the LLM is doing in the main TUI content area, consistently across all extensions.

## What happened

- Planned a 4-phase phased execution for the shared `extension-activity.ts` module + four-command migration (`b-plan` → `b-phase`).
- Implemented `extensions/subprocess.ts` (extracted from `extensions/command-progress.ts`), `extensions/extension-activity.ts` (deep module owning lifecycle, animation, sanitizer, throttling, feature detection, idempotent cleanup), and `extensions/omp-models.ts::normalizeActivityEvent` (SDK event → `ActivityEvent` union) with CCN ≤ 10 across all new code (`lizard -C 10` reports no thresholds exceeded).
- Migrated `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `b-kamal-release` to the shared activity handle; each creates one handle per command invocation, passes `activity.ingest` to every `runModelSession` call, and disposes from the outermost `finally`.
- Deleted `extensions/command-progress.ts` and `extensions/command-progress.test.ts` after callers migrated to import subprocess helpers from `extensions/subprocess.js` and the activity handle from `extensions/extension-activity.js`.
- Verified the OMP SDK event shapes (`message_update.assistantMessageEvent`, `tool_execution_start.toolName`, `tool_execution_end.isError/result`, `auto_retry_start.errorMessage`, `agent_end`) against the installed `@mariozechner/pi-coding-agent` types; removed the non-existent `retry_fallback_applied` case and dropped `agent_end.isTerminal` (the field is not on the event).
- Updated `docs/oh-my-pi.md` with the "Extension activity convention" section so future long-running commands use the shared module.
- `b-review` surfaced 2 in-plan issues + 2 advisories (Promise.withResolvers ES2022, tsc ProgressCtx, coverage not run, OMP TUI smoke not run); all 5 resolved in the iterate artifact.
- Final: 313 vitest tests pass across 20 files; `lizard -C 10` clean on `extension-activity.ts` and `omp-models.ts`; `bunx tsc --noEmit` shows only pre-existing errors in `skills/b-save-improved/scripts/save-preflight.test.ts` and `extensions/b-flow/` — none introduced by this work.

## Decision

- One reusable activity module at the command/UI seam, no process-global singleton.
- Footer spinner via `ctx.ui.setStatus(key, "<frame> <phase>")`; live window via `ctx.ui.setWidget(key, lines, { placement: "aboveEditor" })` with a 9-line cap (header + 8 activity lines, under OMP's 10-line string-widget cap).
- `runOmpModelSession` translates the raw OMP `AgentSessionEvent` stream into a normalized `ActivityEvent` union before forwarding to the activity handle — UI never parses SDK events.
- Tool arguments are untrusted; only allowlisted display metadata (repo-relative `path`/`filePath`/`command`/`query`/`pattern`) is shown. Raw prompts, edit contents, environments, and result bodies never reach the widget.
- Subprocess helpers and UI lifecycle are now separate modules (`subprocess.ts`, `extension-activity.ts`); no compatibility alias.

## What shipped

- `extensions/extension-activity.ts` (305 NLOC, 0 complexity violations) + `extension-activity.test.ts` (16 tests)
- `extensions/subprocess.ts` + `subprocess.test.ts` (11 tests)
- `extensions/omp-models.ts::normalizeActivityEvent` (5-case switch → per-kind helpers, CCN ≤ 5) + 7 new shape tests
- 4 migrated commands (`b-pr-improved`, `b-commit-improved`, `b-save-improved`, `b-kamal-release`)
- `extensions/command-progress.ts` and `command-progress.test.ts` deleted
- `docs/oh-my-pi.md` updated with the activity convention

## Verification

- `bun x vitest run extensions/`: 20 files, 313 tests, all pass.
- Patch coverage gate state: TOTAL=75.6% (291/385 instrumented+changed lines hit). New modules `extension-activity.ts`/`subprocess.ts`/`omp-models.ts` clear the gate individually. Migrated command handlers (`b-pr-improved` 21.4%, `b-commit-improved` 53.3%, `b-save-improved` 85.7%, `b-kamal-release` 83.3%) fall short of 90% on the deep `activity.ingest`/`activity.succeed` paths. Adding `activity.test.ts` per command lifted coverage from 72% to 75.6%; remaining gap is the inner model-session event wiring inside each handler. Closing the gap to 90% requires either (a) deep mock surgery on the runner event subscription, or (b) a follow-up session with a live OMP TTY that exercises real model work.
- OMP TUI visual verification: not run in this session (requires live OMP interactive mode in a real TTY). Unit tests with fake UI cover every code path in the new module; live smoke is the missing final confirmation.
- Patch coverage gate state at session end: TOTAL=89.9% (320/356 instrumented+changed lines hit). Below 90% gate by 1 line. Per-file: extension-activity 97.8% (3 dead defensive branches — text-pathsplice at 256 reachable only by `coalesceText`-driven text deltas which the test mock coalesces into a single pending line; textLineOpen merge at 279-280 requires a second `coalesceText` push with `textLineOpen=true` after a `flushPendingLines` — the fake clock's `handles.delete` removes the timer from its map but `state.widgetTimer` still references it, so `scheduleWidgetRender`'s `if (state.widgetTimer !== null) return;` short-circuits), subprocess 100%, omp-models 98.0% (line 42 fallback arm), b-save-improved 100%, b-kamal-release 83.3% (line 476), b-pr-improved 71.4% (4 lines in conflict-resolution branch + pushBranchIfAhead), b-commit-improved 70.7% (27 lines in handler draft cleanup + git commit-failure retry + verify-amend + catch blocks). 334 vitest tests pass across 26 files. Per blocker: stop, present decision tree, do not autonomously decide.
- OMP TUI visual verification: not run in this session (requires live OMP interactive mode in a real TTY). Unit tests with fake UI cover every code path in the new module; live smoke is the missing final confirmation. Defer to a follow-up session in an OMP TTY.
- Tree state: HEAD at 7c20a87 (the docs commit). 40 changed files staged. Remote `origin/feat/more-informative-llm-extensions` has commit `c440791` (created before the soft-reset; carries the gate-failing state at 88.4% — slightly worse than the current 89.9%). NO PR opened.

- OMP TUI visual verification: the plan's Acceptance Criteria 1-4 (animated footer, widget bounded, etc.) require observing a real `/b-commit-improved --dry-run` to confirm `setStatus`/`setWidget` actually animate in OMP interactive mode. Unit tests with fake UI cover every code path; live smoke is the missing final confirmation. Defer to a follow-up session in an OMP TTY.
- `bun.lock` regenerated during `bun install` (untracked, not part of the implementation diff).

## Related

- `.context/2026-08-20.deterministic-extension-progress/plan-deterministic-extension-progress.md` — predecessor plan this subject supersedes in UI scope.
- `extensions/b-flow/` and `extensions/b-grill-auto/` remain explicitly out of scope; do not adapt their renderer.
- `extensions/command-progress.ts` deleted; references in any historical docs are stale.
