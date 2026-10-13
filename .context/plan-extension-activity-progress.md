---
status: active
date: 2026-09-11
subject: 2026-09-11.extension-activity-progress
topics: [extensions, omp, tui, progress, spinner, model-streaming, widgets]
research: []
iterations: []
memory: []
---

# Plan: Unified live activity for extensions

## User Goal

When an extension makes LLM calls and starts doing work, I can see an animated status indicator and a small live window of what the LLM is doing in the main TUI content area, consistently across all extensions.

## Goal

Create one deep, reusable extension-activity module that owns progress lifecycle, animation, bounded rendering, event normalization, and cleanup. Migrate every currently shipped long-running extension command to that module so progress behavior cannot drift by command.

The primary runtime is OMP. The implementation will use OMP's documented `ctx.ui.setStatus`, `ctx.ui.setWidget`, and nested `AgentSession.subscribe()` behavior while feature-detecting optional UI methods so the package retains its single-source Pi/OMP loading model.

## Context used / assumptions

- User-provided context: add an animated icon beside status and a small live TUI window for long-running model work; the solution must apply across extensions rather than only `b-pr-improved`.
- Existing implementation: `extensions/command-progress.ts` reports phase labels through `notify`, `setStatus`, and `setWorkingMessage`, but has no animation or live activity view. It also mixes UI lifecycle with child-process helpers.
- Existing model seam: `extensions/omp-models.ts::runOmpModelSession()` creates nested sessions for `b-pr-improved`, `b-commit-improved`, and `b-save-improved`, but currently does not subscribe to their events.
- Currently shipped long-running commands are wired from `extensions/index.ts`: `b-pr-improved`, `b-commit-improved`, `b-kamal-release`, and `b-save-improved`.
- `extensions/b-flow/` and `extensions/b-grill-auto/` are unwired/deprecated source, not current runtime surfaces. They are not retrofit targets; the new normalized event interface must remain usable if either is restored.
- Prior work: `.context/2026-08-20.deterministic-extension-progress/plan-deterministic-extension-progress.md` solved frozen phase transitions for three deterministic commands. This plan supersedes its UI architecture rather than adding a second progress convention.
- OMP SDK evidence:
  - `ExtensionUIContext.setStatus()` updates footer status and requests a render.
  - `ExtensionUIContext.setWidget()` supports a temporary widget above/below the editor, limits string-array widgets to ten lines, and requests a render.
  - `AgentSession.subscribe()` emits `message_update` text deltas, tool lifecycle events, retry events, and terminal completion events.
  - Sources: `can1357/oh-my-pi` `docs/extensions.md`, `docs/sdk.md`, `packages/coding-agent/src/extensibility/extensions/types.ts`, and `packages/coding-agent/src/modes/controllers/extension-ui-controller.ts` at commit `f97fa5c95010b62ac34c7357f9a1cae6975e12d6`.
- Assumption: “what the LLM is doing” means observable model output, current tool activity, retries, and phase transitions. Hidden chain-of-thought is neither requested from the provider nor displayed.

## Decisions

### One activity module at the command/UI seam

Create an explicit per-command activity handle; do not use a process-global singleton. Its caller-facing interface should stay small:

- `phase(label)` — start or replace the current phase and ensure animation is running.
- `ingest(event)` — accept a normalized activity event from a model or process adapter.
- `succeed(label)` / `fail(label)` — stop animation, publish the terminal notification, and clear transient UI.
- `dispose()` — idempotent cleanup for every early return, thrown error, cancellation, and session shutdown.

The module hides timers, frame selection, render throttling, line coalescing, bounds, sanitization, feature detection, and widget/status keys. Callers describe work; they do not render it.

### Footer spinner plus temporary widget

- Animate a compact spinner in the footer through `setStatus(key, frame + label)` on a bounded interval. `setStatus` is chosen because OMP redraws it during custom command handlers; `setWorkingMessage` alone does not activate the main-session loading animation for nested/custom work.
- Render the live activity window with `setWidget(key, lines, { placement: "aboveEditor" })`. This is OMP's non-modal, transient main-area surface.
- Do not use `pi.sendMessage()` or a custom message renderer for live updates: that would persist progress into session history and can affect later model context.
- Do not use `ctx.ui.custom()` for progress: it is modal and would unnecessarily take keyboard focus.

### Normalize events before rendering

`runOmpModelSession()` will translate raw OMP `AgentSessionEvent` values into a small internal `ActivityEvent` union before forwarding them. The UI module will never parse provider- or SDK-specific objects.

Required event kinds:

- visible assistant text delta;
- tool start with tool name and a safe target label;
- tool completion/failure without raw result bodies;
- model retry/fallback notice;
- model/session completion.

Tool arguments are untrusted. Extract only allowlisted display metadata such as a repository-relative file path; never render complete prompts, edit contents, command environments, credentials, or raw tool results.

### Bounded and low-noise rendering

- Reserve one widget line for the command/phase header and at most eight activity lines, staying below OMP's ten-line string-widget cap.
- Coalesce adjacent text deltas into the current line instead of adding one line per token.
- Strip ANSI escapes and terminal control characters; normalize newlines; clip each line and the total buffer.
- Throttle widget redraws to a small fixed rate while allowing footer spinner frames to advance independently.
- Emit `notify` only at meaningful phase boundaries, warnings, and terminal outcomes; animation frames must never create transcript/status-message spam.
- If `hasUI` is false or `setWidget`/`setStatus` is absent, retain phase notifications and command behavior without throwing.

## Scope

- Shared animated progress and live activity window for every currently shipped long-running extension command.
- OMP nested-session event streaming through the existing shared model runner.
- Safe, bounded rendering of visible model text and semantic tool activity.
- Non-LLM long operations such as Kamal deployment receive the same animated status lifecycle and semantic phase updates; raw process output remains off by default.
- Pi/headless graceful degradation through structural feature detection.
- Unit, integration/wiring, and actual OMP TUI verification.
- Documentation of the shared extension activity convention.

## Out of scope

- Hidden model reasoning or chain-of-thought. The UI shows only provider-visible text and observable events.
- Persisting the transient activity window in `.context/` or the session transcript.
- A full log viewer, scrolling pane, user-configurable layout, or history replay.
- Rendering raw prompts, full tool arguments/results, child-process environments, or unredacted deploy output.
- Re-enabling or modernizing deprecated/unwired `b-flow` and `b-grill-auto` extensions.
- Changing command semantics, model prompts, git/rebase behavior, release behavior, or provider selection.
- Adding a second OMP-only extension entrypoint or abandoning the package's single-source Pi/OMP loader.

## Affected files

### Create

- `extensions/extension-activity.ts` — deep module containing the activity interface, state model, spinner, bounded widget renderer, sanitizer, throttle, feature detection, and cleanup.
- `extensions/extension-activity.test.ts` — fake-clock and fake-UI behavioral coverage of the public interface.
- `extensions/subprocess.ts` — child-process capture and line-ring helpers extracted from the mixed progress module.
- `extensions/subprocess.test.ts` — moved behavioral coverage for child execution and bounded output capture.

### Modify

- `extensions/omp-models.ts` — subscribe to nested OMP session events, normalize them, forward optional activity events, and always unsubscribe before disposal.
- `extensions/omp-models.test.ts` — prove text/tool/retry normalization and listener cleanup.
- `extensions/b-pr-improved/index.ts` and `extensions/b-pr-improved/__tests__/wire.test.ts` — one activity handle across preflight, each conflict-resolution attempt, push, description synthesis, and PR creation.
- `extensions/b-commit-improved/index.ts` and `extensions/b-commit-improved/__tests__/wire.test.ts` — activity lifecycle around preflight, model drafting, fallback, and commit.
- `extensions/b-save-improved/index.ts`, `extensions/b-save-improved/__tests__/handler.test.ts`, and `extensions/b-save-improved/__tests__/wire.test.ts` — activity lifecycle for preflight, scribe, fallback, auditor, apply, and retain handoff.
- `extensions/b-kamal-release/index.ts` and `extensions/b-kamal-release/__tests__/wire.test.ts` — animated lifecycle for preflight, tag/push, and deploy without exposing raw deployment output.
- `docs/oh-my-pi.md` — document the OMP activity surface and the rule that future long-running extension commands use the shared module.
- `.context/backlog/items/deterministic-extension-progress.md` and `.context/backlog/todo.md` — retarget the existing active progress item to this broader plan instead of creating a duplicate.

### Delete after clean cutover

- `extensions/command-progress.ts`
- `extensions/command-progress.test.ts`

Their UI responsibilities move to `extension-activity.ts`; their subprocess responsibilities move to `subprocess.ts`. No compatibility re-export remains.

## Implementation steps

1. Define the normalized `ActivityEvent` union and the small activity-handle interface in `extension-activity.ts`; write interface-level tests first for lifecycle and observable UI output.
2. Implement the pure bounded activity state: text-delta coalescing, safe tool labels, retry/failure lines, ANSI/control stripping, line clipping, and the nine-line maximum payload.
3. Add the UI adapter: unique status/widget keys, timer-driven spinner frames, throttled widget updates, meaningful notifications, optional-method feature detection, `unref()` where supported, and idempotent terminal cleanup.
4. Split child-process helpers from `command-progress.ts` into `subprocess.ts`, migrate all imports, and delete the obsolete mixed module and its tests after equivalent coverage passes.
5. Extend `runOmpModelSession()` with an optional normalized activity callback. Subscribe before `session.prompt()`, translate supported OMP events, and unsubscribe in `finally` before session disposal. Preserve existing return/error behavior when no callback is supplied.
6. Migrate `b-pr-improved`, `b-commit-improved`, and `b-save-improved` to create exactly one activity handle per command invocation, pass its event sink through every model call including retries/fallbacks, and dispose it from the outermost `finally`.
7. Migrate `b-kamal-release` to the same handle for animated phase progress while keeping the existing bounded failure-tail policy and avoiding raw success-log rendering.
8. Update extension documentation and run focused tests, the full deterministic guardrail contract, and OMP TUI smoke scenarios before completing the plan.

## Acceptance criteria

- [ ] A pending long-running command displays an animated footer icon whose frame changes at least twice while the operation remains active.
- [ ] The footer text always identifies the owning command and current semantic phase.
- [ ] During nested LLM work, a non-modal widget appears above the editor with a header plus no more than eight recent activity lines.
- [ ] Visible assistant text streams into the widget when available; tool-only calls still show current tool activity, so a quiet conflict resolver does not appear frozen.
- [ ] No hidden chain-of-thought is requested or displayed.
- [ ] Raw prompts, edit contents, tool results, environment values, and unallowlisted tool arguments never reach the widget.
- [ ] ANSI/control characters cannot move the cursor, clear the terminal, or inject additional status lines.
- [ ] Model delta bursts are coalesced/throttled rather than causing a repaint per token.
- [ ] `succeed`, `fail`, cancellation, thrown errors, early returns, and repeated `dispose` calls all stop timers and clear both status and widget.
- [ ] `b-pr-improved`, `b-commit-improved`, `b-save-improved`, and `b-kamal-release` use the same module; no command retains a private progress renderer.
- [ ] Headless or Pi runtimes lacking one of the OMP UI methods continue the command and retain low-frequency notifications without crashing.
- [ ] Existing command outputs and side effects remain unchanged apart from transient progress UI.
- [ ] `command-progress.ts` and its old interface are removed after every caller migrates; no compatibility alias or duplicate convention remains.

## Verification

### Automated

- Fake-clock tests advance the activity timer and assert distinct footer frames, stable phase text, and no timer work after disposal.
- Fake-UI tests assert widget placement, maximum line count, bounded line width, text-delta coalescing, control-sequence stripping, notification frequency, and idempotent cleanup.
- Model-runner tests use a fake session subscription to emit text, tool, retry, failure, and completion events; assert the normalized sequence and unsubscribe/dispose ordering.
- Existing command handler/wiring tests assert that each shipped long-running command starts activity before its first awaited operation, forwards model events, and clears UI on success and every early/error path.
- Run focused Vitest files for the shared module/model runner and the four command suites.
- Run `npm test`.
- Run `/b-guardrails-check`; all configured unit, lint, coverage-ratchet, patch-coverage, and complexity gates must pass.

### Actual OMP TUI

Use a disposable repository/worktree and a non-publishing dry run:

1. Stage a harmless text change and run `/b-commit-improved --dry-run` with a configured model slow enough to observe multiple frames.
2. Capture two TUI states during the model call: confirm the footer frame changes while the phase label remains stable, and confirm the above-editor widget updates with bounded model activity.
3. Let the command settle; confirm the status and widget disappear and the draft-only dry-run artifact is the sole command output.
4. Exercise one forced model failure or abort; confirm cleanup still occurs and the existing recovery notification remains visible.
5. Run a harmless `b-kamal-release --dry-run` path to confirm non-LLM commands share the animated lifecycle without a raw-output window.

## Risks

- **Render pressure:** token deltas can arrive much faster than the TUI should repaint. Coalescing and a fixed redraw throttle are required, not optional polish.
- **Terminal injection:** model/tool text is untrusted. Sanitization must happen before buffering and again at the final render seam.
- **Wrong surface:** `setWorkingMessage` does not reliably animate for custom nested work; the footer must be driven by `setStatus`, and the live window by `setWidget`.
- **UI pollution:** custom session messages would persist progress and potentially affect model context. The activity window must remain transient.
- **Silent model calls:** some prompts intentionally produce only tool calls or JSON. Tool lifecycle events and semantic command phases must keep the window informative without inventing reasoning.
- **Cleanup leaks:** forgotten timers or widgets survive early returns. The outermost per-command `finally` and idempotent `dispose()` are hard invariants.
- **Cross-runtime variance:** Pi/print/RPC UI adapters may no-op or omit methods. Feature detection must preserve command behavior, with OMP interactive mode as the fully verified target.
- **Legacy source confusion:** deprecated `b-flow`/`b-grill-auto` have separate event paths. They must not expand this implementation unit; if restored, adapt them to the normalized activity interface rather than adding another renderer.

## Recommended execution shape

This plan touches a shared module, the model-session seam, four command implementations, tests, and documentation. Run `/skill:b-phase` before implementation so the shared contract lands before caller migrations and each phase has a bounded OMP TUI verification target.
