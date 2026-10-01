---
status: active
date: 2026-09-30
subject: 2026-09-30.sql-memory-tui-notice
topics: [sql-memory, tui, jev, activity]
research: []
iterations: []
spec: null
memory: []
sql_memory_ids: [01a0f518-52fe-74d9-8c00-0897723d1855]
---

# Plan: One-line TUI notice when sql_memory is used

## User Goal

Operators watching the TUI see a one-line notice when `sql_memory` reads or writes, with a short synopsis of what was stored or retrieved, in the same compact style as a TypeSafe Jev decision line.

## Goal

`sql_memory` currently has no `renderCall` / `renderResult`. Parent-session calls fall through to OMP's default JSON card. Buck-loop activity already prints `✓ sql_memory` on success and only appends a message on failure (`extensions/omp-models.ts` `asToolEnd` drops the message when `ok`). Jev decisions are the contrast: `choice.ts` streams `Jev picked save (confidence 0.91)` as one activity line.

Add one shared notice string and show it in both places the operator already looks: the tool card, and the buck-loop activity line.

## Context used / assumptions

- User-provided context: communicate `sql_memory` use in the TUI as a one-liner with a short synopsis; mimic the TypeSafe Jev skill's decision output, not a JSON dump.
- Session context: branch `feat/notifier-sql_memory-use` at `e3ffb37`. SQL memory phases 2–4 are done. Recall protocol and save receipts stay as they are.
- Artifacts used: none in this subject. Prior SQL-memory subjects are closed and are not the implementation target.
- Live screen capture of the Jev card was unavailable (Wayland pipewire capture failed). The copy target is the in-repo Jev line `Jev picked save (confidence 0.91)` (`extensions/buck-loop/choice.ts`) and OMP's single status-line shape (icon, title, `: description`, dim meta). Build should match that, not invent a second widget.
- Assumption: the notice is always on when the tool runs, same as Jev. "An option" means this capability, not a new settings flag.
- Assumption: synopsis comes from data already on the call (op, category, truncated body, row count, bound recall text). No extra model call to summarize.
- Assumption: the model still receives the full JSON tool result. The notice is display-only.

## Scope

### In scope

- One pure formatter, `formatSqlMemoryNotice`, that returns a single line and never includes a connection string, password, full SQL statement, or bound secret value.
- Parent TUI: `renderCall` / `renderResult` on `sqlMemoryTool`. Collapsed view is that one line. Expanded view keeps the existing JSON underneath so debugging is not lost.
- Buck-loop activity: successful `sql_memory` tool ends carry the same line in `toolEnd.message`, so the existing widget renders `✓ sql_memory: <notice>`. Failures keep a short reason instead of a raw driver error when the formatter has one.
- Supervisor-side `sqlMemoryRows` / correction writes emit the same line through the existing activity sink when one is present. No sink means no emit.
- Focused tests for the formatter and for the activity line on success.

### Out of scope

- SQL gate, schema, migrations, save-receipt contract, and child role allowlists.
- A settings toggle or env flag to hide the line.
- A second model call to write the synopsis.
- Changing how Jev itself renders.
- Printing full memory bodies, raw SQL, or `SQL_MEMORY_URL` in the collapsed line.

## Affected files

| Path | Planned change |
|---|---|
| `extensions/sql-memory/notice.ts` | New pure formatter. |
| `extensions/sql-memory/notice.test.ts` | Line shape, truncation, secret redaction, zero-row and denial cases. |
| `extensions/sql-memory/index.ts` | Attach renderer; put `notice` on result `details`; extend `SqlMemoryCallResult` with the notice. |
| `extensions/sql-memory/index.test.ts` | Renderer is present; details include the notice; model-facing `content` stays JSON. |
| `extensions/omp-models.ts` | Successful tool ends keep a short `message` when result details carry `notice`. |
| `extensions/buck-loop/run-step.ts` | Forward that message; supervisor SQL writes emit the same line when an activity sink exists. |
| `extensions/buck-loop/__tests__/run-step.test.ts` | Success path asserts the one-line notice, not a silent `✓ sql_memory`. |
| `docs/sql-memory.md` | One paragraph: what the line shows and what it never shows. |

## Line contract

One line. No embedded newlines. Cap the synopsis so `✓ sql_memory: ` plus the notice fits the buck-loop widget width (64). Parent card may use the same string.

| Op | Collapsed line |
|---|---|
| insert / correct success | `Memory wrote · <category> · "<synopsis>"` |
| recall success, N > 0 | `Memory recall · N rows · "<query>"` |
| recall success, N = 0 | `Memory recall · 0 rows` |
| gate denial | `Memory denied · <short reason>` |
| work failure | `Memory failed · <short reason>` |
| migrate success | `Memory migrate · applied N` |

`<synopsis>` is the memory `body` already in the call, trimmed and truncated. `<query>` is the bound recall text (`$2`), not the SQL. `<category>` is omitted when absent. If a value matches the existing secret key pattern (`password`, `connection`, `database_url`, `sql_memory_url`, `url`), replace the synopsis with `redacted`.

`renderCall` while the call is in flight: `Memory <op>…` and nothing else.

## Implementation steps

1. Add `formatSqlMemoryNotice` and unit-test the table above, including a body that contains a newline or a connection string.
2. Call it from `sqlMemoryTool` execute paths (`sql`, `correct`, `migrate`) and from the gate/work error returns. Store the string on `details.notice`. Leave `content[0].text` as the current JSON.
3. Add `renderCall` / `renderResult` that return a single `Text` line from that notice. When `expanded` is true, append the existing JSON text under the line. Import `Text` from `@mariozechner/pi-tui` (already used by `extensions/buck-models/model-picker.ts`). Do not import OMP-only `renderStatusLine`.
4. In `asToolEnd`, if the settled result details contain a string `notice`, pass it as `toolEnd.message` on success as well as failure. Confirm the subscribed event actually carries `details` before relying on it; if it does not, emit the line from the existing `onResult` callback in `run-step.ts` instead. Do not guess the payload.
5. Thread the same notice through supervisor `sqlMemoryRows` / correction calls when `onActivity` is available. Library callers without a sink stay silent.
6. Update `docs/sql-memory.md` with the line contract and the redaction rule.
7. Run the focused suites and `npm run guardrails:check`.

## Acceptance criteria

- [ ] A parent-session `sql_memory` call shows one collapsed line and does not dump SQL or row JSON until expanded.
- [ ] A write or correction line includes category (when present) and a truncated body synopsis.
- [ ] A recall line includes the row count and the bound query text, not the SQL.
- [ ] A denial or failure line is one short reason, with no connection string.
- [ ] Buck-loop activity shows `✓ sql_memory: <notice>` on success, not a bare `✓ sql_memory`.
- [ ] The model-facing tool `content` is still the JSON result.
- [ ] Focused sql-memory and run-step tests pass, and `npm run guardrails:check` passes.

## Verification

- `bun test extensions/sql-memory/notice.test.ts extensions/sql-memory/index.test.ts extensions/buck-loop/__tests__/run-step.test.ts`
- `npm run guardrails:check`
- Live smoke, parent session: one recall and one no-op or denied call; collapsed card is one line; expand still shows JSON.
- Live smoke, `/buck-loop` save or a child that calls `sql_memory`: activity widget shows the notice on the `sql_memory` line.

## Risks

| Failure mode | Impact | Mitigation | Rollback |
|---|---|---|---|
| Notice leaks SQL, a URL, or a bound secret. | Credential or query text in the scrollback. | Formatter drops statements and redacts secret-keyed values; tests cover a connection string and a newline. | Revert the renderer; default JSON card returns. |
| `toolEnd.message` on success is not in the subscribe payload. | Loop stays silent while the parent card works. | Read the event once; fall back to the existing `onResult` callback. | Parent card still shows the line. |
| Synopsis truncates so far it is useless. | Operator sees a label with no content. | Keep category plus a body prefix; zero-row and denial lines do not pretend to have a synopsis. | Widen only the parent card, not the 64-col widget. |

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:

1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues go to a separate `/b-plan` → `/b-build`. If review flags documentation impact beyond the paragraph in this plan, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.
