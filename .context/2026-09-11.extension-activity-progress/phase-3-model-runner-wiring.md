---
status: completed
phase: 3
order: 3
plan: plan-extension-activity-progress.md
phases_overview: plan-extension-activity-progress-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build
goal: "Make `runOmpModelSession()` emit normalized `ActivityEvent`s through an optional callback, so commands do not have to subscribe to SDK events themselves."
omp_execution: none
files:
  - extensions/omp-models.ts
  - extensions/omp-models.test.ts
from_plan_steps: [5]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "`runOmpModelSession()` accepts an optional `onActivity?: (event: ActivityEvent) => void` and forwards normalized events for visible text, tool lifecycle, retries, and completion."
  - "The runner subscribes to the session before `session.prompt()` and unsubscribes in the outer `finally` before `session.dispose()`."
  - "Tool argument rendering extracts only allowlisted metadata (e.g. repo-relative file path) and never forwards raw prompts, edit contents, command environments, credentials, or tool result bodies."
  - "Existing return/error behavior is preserved when no callback is supplied."
  - "Fake-session tests assert the normalized sequence for text, tool, retry, failure, and completion events, plus unsubscribe/dispose ordering."
  - "`npm test` passes; `/b-guardrails-check` reports `status: pass` with no new complexity violations."
completed_at: 2026-09-11
completed_by: goal-mode-session
---

# Phase 3: Model runner wiring

## Context

The parent plan's User Goal is: animated status plus a small live window of observable model activity, consistently across all extensions. Phase 2 defined the normalized `ActivityEvent` union. Phase 3 makes the model runner emit those events so that callers can stay untrusted-input-free and never touch SDK events directly.

`extensions/omp-models.ts::runOmpModelSession()` creates nested OMP sessions for `b-pr-improved`, `b-commit-improved`, and `b-save-improved`. It currently subscribes to nothing. The new callback path translates `message_update`, tool lifecycle, retry, and completion events into the union `extension-activity.ts` accepts.

## Implementation Details

1. Extend `runOmpModelSession()`'s options with an optional `onActivity?: (event: ActivityEvent) => void`.
2. Subscribe to the nested session before calling `session.prompt()`; translate supported events; ignore unsupported event types silently.
3. Unsubscribe in the outer `finally` before `session.dispose()` to guarantee no listener outlives the session.
4. Add tests in `extensions/omp-models.test.ts` using a fake session that emits the SDK event shapes; assert the normalized sequence and the unsubscribe/dispose ordering.
5. Run `npm test` and `/b-guardrails-check`.

## Risks

- Event-shape drift: the OMP `AgentSessionEvent` union is large and version-sensitive. Use a narrow `switch` and an `unknown` default that no-ops; do not assume fields beyond what the documentation guarantees.
- Listener leak: forgetting to unsubscribe would leak memory across invocations and could observe events from the wrong session.
- Tool-argument injection: extracting even one unsafe field (full prompt, environment, raw edit) into the widget is a regression. Limit extraction to allowlisted display metadata.

## Verification

- `extensions/omp-models.ts` accepts the new optional callback.
- `extensions/omp-models.test.ts` covers the normalized event sequence for visible text, tool start, tool completion, retry, failure, and completion, and asserts the listener is detached before `dispose()`.
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
