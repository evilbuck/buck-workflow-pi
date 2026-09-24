---
status: active
date: 2026-09-24
subject: 2026-09-24.buck-loop-streaming-log-drain
topics: [buck-loop, streaming, jsonl, observability]
research: []
iterations: []
memory: [buck-loop-streaming-log-drain-plan-2026-09-24.md]
---

# Plan: Tail-able `/buck-loop` activity log

## User Goal

Operators can read `/buck-loop`'s nested-session activity continuously from another terminal while the loop is running, instead of being limited to the six-row in-chat widget.

## Goal

Add a local, versioned JSONL drain at `.context/workflow/buck-loop.log.jsonl`. `/buck-loop <plan>` writes a fresh log, `/buck-loop --resume` appends to that log, and `tail -F .context/workflow/buck-loop.log.jsonl` exposes records before the loop settles.

## Context used / assumptions

- Buck capability: `full`. Probe source: system available-skills catalog; `b-build`, `b-review`, and `b-save` are all loaded.
- User-provided context: implement option 1 from the streaming-log investigation — a tail-able JSONL sink attached to the existing activity callback.
- Session research: three scouts independently found no emitter, RPC stream, reader API, or persisted nested-session transcript. The only live stream is the single `LoopDeps.onActivity` callback currently wired to `activity.ingest`.
- Code evidence:
  - `extensions/buck-loop/run-step.ts:217-220` subscribes to the nested `AgentSession`, normalizes SDK events, and forwards each `ActivityEvent` through `onActivity`.
  - `extensions/buck-loop/choice.ts:134-163,303-323` uses the same callback for Jev/smol decision activity.
  - `extensions/buck-loop/index.ts:243-267` is the composition root and sole production consumer; it already receives progress, activity, synthetic failure, and terminal state.
  - `extensions/extension-activity.ts:20-46` defines the stable normalized event contract. Its private rendering buffer is intentionally bounded and is not a durable transcript.
  - `extensions/buck-loop/persist.ts:61-109` persists only the state projection and establishes the extension's local `.git/info/exclude` hygiene pattern.
- Prior context: `buck-loop-streaming-output-2026-09-19.md` established the six-row widget; `buck-loop-live-feedback-2026-09-18.md` established visible, structured activity without a disk drain.
- No subject-local research/spec artifacts exist.
- The drain records normalized `ActivityEvent` values, not raw SDK events or full tool arguments. This preserves the current trust boundary and avoids coupling the file format to host-internal event shapes.
- The file is local runtime state. It must be excluded through `.git/info/exclude` and removed from the index if previously tracked, matching projection hygiene.
- Only `start` and `resume` own the drain. `--status` and `--stop` must not truncate, append to, or recreate the current log.

## Scope

- Add a versioned JSONL record contract and writer dedicated to `/buck-loop`.
- Fan out the existing progress/activity/terminal signals to both the UI widget and the writer.
- Make records observable on disk before `handleLoop` resolves.
- Preserve invocation order and deterministic close behavior.
- Document the exact `tail -F` command, lifecycle semantics, and privacy implications.

## Out of scope

- Exposing an EventEmitter, RPC endpoint, web socket, or new slash command.
- Persisting raw `AgentSession` events, full prompts, tool arguments, or complete child transcripts.
- Changing `LoopDeps`, `runStep`, `choice`, `normalizeActivityEvent`, or the six-row widget.
- Cross-run retention, rotation, compression, filtering, replay, or log search.
- Logging unrelated extension commands.

## Record contract

Every line is one JSON object with:

- `version: 1`
- `timestamp`: ISO-8601 UTC
- `invocationId`: UUID generated once per `/buck-loop` start/resume invocation
- `type`: one of `invocation`, `progress`, `activity`, or `terminal`
- Type-specific payload:
  - `invocation`: `command` (`start` or `resume`) and optional plan `path`
  - `progress`: the existing `LoopProgress` fields (`state`, `operation`, `label`, optional `target`)
  - `activity`: the existing normalized `ActivityEvent`
  - `terminal`: final `state`, `reason`, and `ok`

A `start` invocation truncates the prior file before writing its invocation record. A `resume` invocation appends a new invocation record. The writer uses one open stream per invocation, preserves call order, and awaits stream completion during cleanup. Stream creation/write/close failures produce one visible warning and disable only the drain; they must not change the loop state or strand the UI cleanup path.

## Affected files

- `extensions/buck-loop/activity-log.ts` — new JSONL record types, start/resume lifecycle, local Git-ignore hygiene, ordered writer, and no-op behavior for non-running commands.
- `extensions/buck-loop/index.ts` — create the drain at the command boundary; fan out progress/activity/failure/terminal events; await closure in `finally`.
- `extensions/buck-loop/__tests__/activity-log.test.ts` — writer contract, truncation/append semantics, valid JSONL ordering, local-ignore behavior, and nonfatal I/O failure.
- `extensions/buck-loop/__tests__/wire.test.ts` — prove an event is visible in the file while `handleLoop` is still unresolved and that status/stop leave the file untouched.
- `docs/howto/watch-buck-loop-activity.md` — one-action operator guide ending with a live-observation check.
- `docs/howto/README.md` — link the new action.

`extensions/buck-loop/loop.ts`, `run-step.ts`, `choice.ts`, and `extensions/extension-activity.ts` remain unchanged; the composition root already has every required signal.

## Implementation steps

1. Add `activity-log.ts` with an explicit `BuckLoopLogRecord` union and `createBuckLoopActivityLog({ cwd, command, path, onWarning })` factory. Return a no-op handle for `status` and `stop`.
2. For `start`, create/truncate `.context/workflow/buck-loop.log.jsonl`; for `resume`, create/append it. Write the invocation record immediately so `tail -F` can attach before the first nested event.
3. Mirror `persist.ts` runtime-file hygiene for the log path: create the workflow directory, add the exact repo-relative path to `.git/info/exclude` once, and run `git rm --cached --ignore-unmatch` only for that file. Non-Git workspaces still get the log.
4. Keep one writer open for the invocation. Serialize versioned records in call order, one newline-terminated JSON object per record; report only the first writer error through `onWarning`, stop further log writes, and make `close()` idempotent.
5. In `index.ts`, define one activity dispatcher that calls both `activity.ingest(event)` and `log.activity(event)`. Reuse it for nested activity and the synthetic `toolEnd` failure event so the widget and file cannot diverge.
6. Fan `onProgress` to `activity.phase` and `log.progress`. Write the terminal record before calling `activity.succeed`/`activity.fail`; on thrown supervisor errors, write the synthesized blocked/aborted terminal result. Always await log closure and dispose the widget.
7. Add focused unit and command-surface tests. The live-drain integration test must pause the mocked `handleLoop`, emit an activity event, read the JSONL record before settlement, then release the loop and assert the terminal record and cleanup.
8. Add the operator how-to with `tail -F`, start/resume behavior, the fixed path, JSONL shape, and a warning that model text/tool targets are written to local disk even though raw prompts/tool arguments are not.

## Acceptance criteria

- [ ] While `/buck-loop` is unresolved, a normalized nested-session activity event is readable from `.context/workflow/buck-loop.log.jsonl` as valid JSON.
- [ ] Every line conforms to the version-1 discriminated record contract and records one invocation id and ISO timestamp.
- [ ] `start` truncates the previous run; `resume` appends; `status` and `stop` leave the file byte-for-byte unchanged.
- [ ] Progress, activity, synthetic failure activity, and terminal state appear in emission order.
- [ ] Widget behavior remains unchanged: the newest six rows render, terminal status appears, and UI keys clear afterward.
- [ ] Logger open/write/close failure warns once but does not alter the supervisor result or prevent UI disposal.
- [ ] The runtime log is locally Git-ignored and is not left staged/tracked.
- [ ] Operator documentation provides a working `tail -F` command and discloses on-disk content/retention semantics.

## Verification

- Focused behavior: `npx vitest run extensions/buck-loop/__tests__/activity-log.test.ts extensions/buck-loop/__tests__/wire.test.ts --reporter=verbose`.
- Live-boundary proof in `wire.test.ts`: read the activity record before resolving the mocked supervisor promise; this specifically proves streaming rather than end-of-run persistence.
- Throwaway smoke in a temporary Git repository: open a `start` drain, emit progress/activity, confirm a separate reader sees complete newline-delimited records before `close()`, close, reopen as `resume`, and confirm append order. Remove the script/temp tree afterward.
- Full deterministic contract: `npm run guardrails:check` must pass.
- Documentation check: run the documented `tail -F` command against the throwaway smoke and observe at least the invocation and activity records before termination.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact for in-plan issues, run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate plan. If review flags living-document or how-to impact beyond the files above, run `/b-docs` and/or `/b-howto` before save.
4. Run `/b-save` to consolidate memory and review artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted, resume from this active plan or its latest iterate artifact.

## Risks

- **Sensitive local content:** normalized text deltas and tool targets may contain private project information. Mitigation: exact local Git exclusion, latest-run truncation on start, no raw SDK/tool-argument persistence, and explicit documentation.
- **Streaming I/O pressure:** text deltas can be frequent. Mitigation: one persistent write stream rather than `appendFile` per event; preserve Node backpressure/error signals and await final flush.
- **Observability changing control flow:** a full disk or permission error could otherwise break the loop. Mitigation: logger errors are warning-only, disable further drain writes, and never escape through `onActivity`.
- **Accidental log destruction:** status/stop must not open the writer, and resume must never truncate. These command boundaries receive dedicated tests.
- **Tail behavior across fresh starts:** a fresh start truncates the fixed file. Documentation uses `tail -F`, which follows recreation/truncation more robustly than `tail -f`.
