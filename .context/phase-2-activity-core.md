---
status: completed
phase: 2
order: 2
plan: plan-extension-activity-progress.md
phases_overview: plan-extension-activity-progress-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Ship a deep `extension-activity.ts` module that owns progress lifecycle, animation, bounded rendering, sanitizer, throttle, feature detection, and idempotent cleanup."
omp_execution: none
files:
  - extensions/extension-activity.ts
  - extensions/extension-activity.test.ts
from_plan_steps: [1, 2, 3]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "`extensions/extension-activity.ts` exports a `ActivityEvent` union covering visible text deltas, tool start/complete/failure, model retry/fallback, and completion."
  - "Public handle interface stays small: `phase(label)`, `ingest(event)`, `succeed(label)`, `fail(label)`, `dispose()`."
  - "Footer spinner animates at least two distinct frames while the handle is active (verified with a fake clock)."
  - "Live activity widget emits at most one header line plus eight activity lines, never exceeding OMP's documented 10-line string-widget cap."
  - "ANSI escapes and terminal control characters are stripped before buffering; cursor-move and clear-screen sequences cannot reach the TUI."
  - "Model text deltas coalesce into the current line rather than producing one widget line per token."
  - "`dispose()` is idempotent and clears both status and widget even after repeated calls, early returns, and thrown errors."
  - "Headless or Pi runtimes that lack one of the OMP UI methods continue to receive notifications without crashing."
  - "Fake-clock and fake-UI tests cover lifecycle, throttling, sanitization, coalescing, notification frequency, and idempotent cleanup."
  - "`npm test` passes; `/b-guardrails-check` reports `status: pass` with no new complexity violations."
completed_at: 2026-09-11
completed_by: goal-mode-session
---

# Phase 2: Activity core

## Context

The parent plan's User Goal is: animated status plus a small live window of observable model activity, consistently across all extensions. This phase delivers the deep module that every long-running command will use, but does not yet wire it into the model runner or migrate callers. Phase 2 is the contract that later phases plug into.

The module must hide timers, frame selection, render throttling, line coalescing, sanitization, bounds, feature detection, and widget/status keys. The interface stays small so callers describe work, not rendering. OMP is the primary runtime; the module uses `setStatus()` for the footer and `setWidget()` for the live window, with structural feature detection so Pi/print/RPC adapters that omit a method do not crash.

## Implementation Details

1. Write interface-level tests first for the public handle API and observable UI output (footer frame advance, widget cap, sanitization, coalescing, idempotent cleanup, feature detection).
2. Implement the pure bounded activity state: text-delta coalescing, safe tool labels, retry/failure lines, ANSI/control stripping, line clipping, and the nine-line maximum payload.
3. Add the UI adapter: unique status/widget keys, timer-driven spinner frames, throttled widget updates, meaningful notifications at phase boundaries, optional-method feature detection, `unref()` on timers where supported, and idempotent terminal cleanup.
4. Export the `ActivityEvent` union so `extensions/omp-models.ts` can adopt it in Phase 3.
5. Run focused Vitest files for the new module plus `npm test` and `/b-guardrails-check`.

## Risks

- Render pressure: token deltas can arrive much faster than the TUI should repaint. Coalescing and a fixed redraw throttle are required, not optional polish.
- Terminal injection: model/tool text is untrusted; sanitization must happen before buffering and again at the final render seam.
- Wrong surface: `setWorkingMessage` does not reliably animate for custom nested work; the footer must be driven by `setStatus` and the live window by `setWidget`.
- Cleanup leaks: forgotten timers or widgets survive early returns. Idempotent `dispose()` is a hard invariant.

## Verification

- `extensions/extension-activity.ts` and `extensions/extension-activity.test.ts` exist.
- Fake-clock tests advance the activity timer and assert distinct footer frames, stable phase text, and no timer work after disposal.
- Fake-UI tests assert widget placement, maximum line count, bounded line width, text-delta coalescing, control-sequence stripping, notification frequency, and idempotent cleanup.
- OMP TUI smoke (in a disposable worktree): create a handle, advance the phase through a sequence, observe at least two distinct footer frames and the above-editor widget with bounded lines.
- `npm test` exits 0.
- `/b-guardrails-check` returns `status: pass`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
