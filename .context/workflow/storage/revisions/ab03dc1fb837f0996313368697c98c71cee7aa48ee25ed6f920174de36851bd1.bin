---
status: completed
date: 2026-10-08
subject: 2026-10-08.sql-memory-turn-hook
topics: [omp-hooks, sql-memory, turn-capture, opt-out]
research: []
iterations: []
memory: []
sql_memory_ids: ["01a11e81-2273-7281-bcf6-71658669c1a9", "01a11e87-5bfc-7e6c-8285-a8d22ed9d5f2", "01a11e8d-c3a4-7400-8f8b-5243bf4eb42e", "01a11ea8-fcf8-737c-a262-88b071c091c8"]
---

# Plan: SQL memory turn hook

## User Goal

The person running OMP gets durable session facts saved to SQL memory without a manual `/b-save`. Capture is on by default when a SQL memory connection is available, and they can turn it off.

## Goal

Ship an OMP package hook that, every three completed user prompts, stores at most one durable fact through the same writer as `sql_memory` `remember`. No fact means no write. Missing connection or an explicit opt-out means the hook does nothing.

## Context used / assumptions

- User-provided context: look at [OMP hooks](https://omp.sh/docs/hooks); run a hook every 3 turns; save a useful memory with the `sql_memory` tool; provide an on/off control.
- Session choices (2026-10-08): on by default with opt-out; count a completed user prompt, not a model round; save one durable fact or nothing; package hook, on when a connection is available.
- OMP hook contract: a direct `.ts` file under package `hooks/post/` default-exports a factory `(pi: ExtensionAPI) => void`. `pre`/`post` do not select events. `agent_end` fires once per submitted prompt with `messages` and optional `willContinue` (automatic continuation already scheduled). `turn_end` is one model/tool round and is the wrong counter. Notification handlers have a 30s budget; a throw is reported and does not block the session. Persist hook state with `pi.appendEntry()`, not an in-memory counter. `pi.sendUserMessage()` always starts another turn.
- This package does not ship `hooks/` today. OMP still walks `hooks/post/` on a registered package root (`docs/extension-loading.md`). `package.json` `files` does not include `hooks`, so a published tarball would drop the file unless that array changes.
- `sql_memory` registers only when `SQL_MEMORY_URL` is set (`extensions/sql-memory/index.ts` `wire`). `remember` requires `body` and `subject`, defaults `category` to `project`, and dedupes identical subject + phase + body + previousId (`extensions/sql-memory/remember.ts`). Call `rememberSqlMemory`. Do not assemble INSERT/UPDATE.
- Closed judgments use `createTypeSafeEvaluator()` (`extensions/typed-output/evaluator.ts`). Jev does not write prose. A missing key or provider error fails closed. Do not imitate Jev with a chat model.
- `runOmpModelSession` defaults to a 60s timeout and a nested agent session (`extensions/omp-models.ts`). That exceeds the hook budget. Do not use it at that default, and do not prompt the parent agent to call the tool.
- Prior framing (Q4, `.context/2026-09-28.postgres-agent-memory/grill-session-postgres-agent-memory.md`): phase 1 has no required Jev gate and no `turn_end` auto-writer. `docs/sql-memory.md` still says that. Confirmed replacement: an `agent_end` writer, on by default when `SQL_MEMORY_URL` is set, with opt-out. Ordinary `remember` and `/b-save` stay ungated. Evidence: the four answers in this session.
- Toggle precedent is `isPlanArtifactEnabled` (`extensions/plan-artifact.ts`): env overrides settings; first file that defines the key wins (project `.pi` / `.omp`, then user `.pi` / `.omp`). This feature inverts the default: absent key + URL set = on.

## Light Grill

- Q1: User goal — automatic durable facts, off until enabled? → resolved: on by default, opt-out by choice (replaced the recommended draft).
- Q2: What counts as one turn? → resolved: completed user prompt (`agent_end` without `willContinue`). Recommended.
- Q3: What is saved on the third prompt? → resolved: one durable fact, or nothing. Jev fail-closed to skip. Direct `remember`, not a prompted agent turn. Recommended.
- Q4: Where does it live, and what is the default? → resolved: package hook, on by default if a connection is available (replaced default-off).

## Decision Closure

Selected course: a package `hooks/post` observer, enabled when `SQL_MEMORY_URL` is set unless the operator opts out. Count completed user prompts. On every third, ask Jev whether the window holds one durable fact. Store only if yes, through `rememberSqlMemory`. Skip on any judgment, extraction, or write failure. Do not start another agent turn.

Evidence: OMP hooks docs (discovery, `agent_end`, 30s budget, `appendEntry`); `wire()` URL gate; `rememberSqlMemory` contract; `createTypeSafeEvaluator` fail-closed path; this session's four answers superseding Q4's "no auto-writer".

Excluded scope: see Out of scope. Next action: `/skill:b-phase` on this plan before build. The write path is a trust-boundary change and should not land as one unsplit patch.

## Assumptions Ledger

| id | statement | status | blocking | evidence / validation_path |
|---|---|---|---|---|
| A-1 | OMP loads `hooks/post/turn-memory.ts` from this package root by sibling discovery, without a second `omp.extensions` entry. | validated | false | `docs/extension-loading.md` sibling table; omp.sh hooks "Package and share hooks". Smoke: after install, `/extensions` shows the file once. |
| A-2 | `agent_end.willContinue === true` is not a completed user prompt. | validated | false | omp.sh hooks lifecycle table: `willContinue` means an automatic continuation is already scheduled. |
| A-3 | "Connection available" means `SQL_MEMORY_URL` is set, not a live ping. A dead URL skips that window and does not flip the feature off. | validated | false | `wire()` uses the env var as the only registration gate (Q18/Q19). User answer "if connection is available" is implemented as that gate. |
| A-4 | Jev, an 8s extraction, and the SQL write can be aborted inside the 30s hook budget without a write. | deferred | false | validation_path: unit test — hung extract is aborted, `rememberSqlMemory` is not called, the handler returns. |
| A-5 | Loading the hook factory with `SQL_MEMORY_URL` unset does not load `pg`. | deferred | false | validation_path: import the factory with the env unset and assert `pg` is absent from the module graph. Dynamic-import `rememberSqlMemory` only after enablement passes. |
| A-6 | `agent_end` may not name the prompt source, so an extension-triggered loop can count. | deferred | false | validation_path: during build, read the `agent_end` payload type. If a source field exists, ignore `extension`. If not, document that those loops count, and keep this hook from creating turns. |

## Material Risks

- failure_mode: the hook stores a secret, a transcript dump, or a non-fact.
  impact: the shared project memory store recalls private or useless text.
  mitigation: exclude tool results from the window; redact bearer tokens, `SQL_MEMORY_URL`, and obvious key assignments before Jev and before write; cap the fact at one sentence; Jev `noul >= 0.70` or skip; empty-after-redact skips.
  rollback_or_fallback: `BUCK_TURN_MEMORY=0` stops new writes immediately. Invalidate a bad row with `remember` `previousId` (the existing successor path).
  validation_path: a window containing `Authorization: Bearer …` never appears in the `remember` body.

- failure_mode: the handler throws or exceeds 30s.
  impact: omp reports an extension error on that prompt. A timed-out write could also double-insert if retried.
  mitigation: catch every failure; abort Jev/extract/SQL on their own deadlines; `appendEntry` a consumed marker before the slow work so a replay skips.
  rollback_or_fallback: opt out. The consumed marker is the fallback that prevents a retry storm.
  validation_path: tests for thrown Jev, thrown SQL, and a hung extract. Each returns without calling `remember` more than once, and a second pass of the same window id does not call it again.

- failure_mode: operators still read Q4 as "no auto-writer" and treat the hook as a bug, or cannot find the off switch.
  impact: surprise writes, or no way to stop them without deleting package files.
  mitigation: same change revises `docs/sql-memory.md` and adds `docs/howto/toggle-turn-memory.md`. `session_start` notifies on/off when `ctx.hasUI`.
  rollback_or_fallback: env opt-out does not require uninstalling the package.
  validation_path: the how-to **Eat** step is `BUCK_TURN_MEMORY=0` plus a settings `enabled: false`, each resulting in zero `remember` calls across three completed prompts.

Trust boundary: the hook reads prompt text and writes the shared SQL store as the git author of `ctx.cwd`. Failure consequence is a bad project memory, not a shell command. It must not call `pi.sendUserMessage` or `sendMessage({ triggerTurn: true })`.

## Scope

- Package hook `hooks/post/turn-memory.ts`: default-export factory, subscribe to `session_start` and `agent_end` only.
- Testable logic under `extensions/turn-memory/`: enablement, window selection, capture. The hook file only adapts `pi`/`ctx` to those functions.
- Enablement: on iff `SQL_MEMORY_URL` is non-empty and the operator has not opted out.
  - `BUCK_TURN_MEMORY=0` or `false` forces off. `1` or `true` does not override a missing URL.
  - Else the first settings file that contains `buckTurnMemory` wins, same candidate order as `isPlanArtifactEnabled`. `enabled === false` is off. Absent key is on.
- Counter: one tick per `agent_end` whose `willContinue` is not `true`. Source of truth is `turn-memory` custom entries (`pi.appendEntry`), rebuilt from `ctx.sessionManager.getEntries()` each event. An in-memory number is not authority.
- Window: the last three unticked-consumed prompts. Text is the user prompt plus the final assistant text, capped at 12,000 characters. Exclude tool-result payloads.
- On the third tick, write a consumed marker for that window id (session file + the three end identities) before any model or SQL call.
- Usefulness: one TypeSafe `noul` via `createTypeSafeEvaluator()`. State is the capped window. Yes criterion: one durable decision, convention, pitfall, or correction that would still matter in a later session. No criterion: chatter, status, a question, or nothing durable. Store only when the yes probability is `>= 0.70`. Missing answer, error, or unavailable Jev skips. No chat-model fallback.
- Body: one injected completion, tools empty, hard cap 8s, thinking off. It returns one sentence or empty. Empty, a multi-paragraph dump, or a body that still contains a redacted secret skips. Category stays `project`. `subject` is `turn-memory`. `phase` is the window id, so an identical retry hits `rememberSourceKey` and returns the existing id.
- Write: dynamic-import `rememberSqlMemory` only after enablement passes. Pass `cwd: ctx.cwd`. Do not open a second pool type; use the same lazy pool helper the tool uses when the URL is set.
- UI: `session_start` notifies `turn-memory: on`, `off (no SQL_MEMORY_URL)`, or `off (opt-out)` when `ctx.hasUI`. A successful save notifies the id. Skips stay quiet.
- Docs: narrow the Q4 sentence in `docs/sql-memory.md`; note the shipped hook in `docs/extension-loading.md`; add the toggle how-to and a line in `docs/howto/README.md`. Add `hooks` to `package.json` `files`.

## Out of scope

- Replacing `/b-save` or the explicit `remember` tool call. Both stay.
- A Jev gate on ordinary `remember` or recall.
- Counting `turn_end` / model rounds.
- Asking the parent agent to call `sql_memory` (`sendUserMessage`, `triggerTurn`).
- Scanning nested session JSONL from the parent. Child sessions that do not load this package are not captured.
- Pi, Codex, or Claude hook parity. No OMP hook discovery there; file-mode save is unchanged.
- Category choice beyond `project`. Embeddings. Recall ranking. Schema migrations.
- A live connect probe on every prompt.
- A second listener in `extensions/index.ts`.
- Default-off. That was the rejected option.
- Adding the hook path to `omp.extensions` unless the A-1 smoke shows sibling discovery missed it. Deduplicate if both would load.

## Affected files

- `hooks/post/turn-memory.ts` (new)
- `extensions/turn-memory/enable.ts` (new)
- `extensions/turn-memory/window.ts` (new)
- `extensions/turn-memory/capture.ts` (new)
- `extensions/turn-memory/__tests__/enable.test.ts` (new)
- `extensions/turn-memory/__tests__/window.test.ts` (new)
- `extensions/turn-memory/__tests__/capture.test.ts` (new)
- `package.json` — `files` includes `hooks`
- `docs/sql-memory.md`
- `docs/extension-loading.md`
- `docs/howto/toggle-turn-memory.md` (new)
- `docs/howto/README.md`

## Implementation steps

1. Pure enablement. Matrix: URL missing, URL set, env `0`/`1`/`false`/`true`, project settings `enabled: false`, global settings, env overriding settings, invalid JSON skipped. Default with URL and no key is on.
2. Pure window selector. Ignore `willContinue`. Rebuild ticks from custom entries. The third new tick returns a window id and the capped text. A consumed marker for that id returns nothing. Tool results never enter the text. Redaction drops bearer tokens and the connection string.
3. Capture orchestrator with injected Jev, completion, and `remember`. Order: consumed marker, Jev, extract, remember. Skip paths do not call later stages. `noul` below 0.70 skips. Hung extract aborts and does not remember. Thrown remember is caught. Identical subject/phase/body returns the existing id (delegate to `rememberSqlMemory`; do not reimplement the source key).
4. Hook factory. Register `session_start` notify and `agent_end` handler. Dynamic-import the SQL writer only when enablement is on. No `pg` import at factory load. No `sendUserMessage`.
5. Package surface. Add `hooks` to `files`. Do not register a second copy from `extensions/index.ts`.
6. Docs. Replace the absolute "no auto-writer" sentence with: ordinary remember and `/b-save` stay ungated; the package hook is a separate opt-out writer on `agent_end`. How-to: check status, turn off with env, turn off with settings, turn back on by removing the opt-out while the URL is set. **Eat**: three completed prompts produce no remember call while opted out, and a UI notify names the off reason.
7. Tests named above. Do not assert source text. Assert remember was or was not called, and with what body/subject/phase.

## Acceptance criteria

- [x] With `SQL_MEMORY_URL` set and no opt-out, the hook is on. With the URL unset, or `BUCK_TURN_MEMORY=0`, or `buckTurnMemory.enabled: false`, it is off. Env overrides settings. `BUCK_TURN_MEMORY=1` does not enable a missing URL.
- [x] Three completed `agent_end` events (no `willContinue`) produce one capture attempt. `willContinue: true` does not tick. A reload that replays the same entries does not attempt a second write.
- [x] Jev yes `>= 0.70` and a one-sentence extraction call `rememberSqlMemory` with `subject: "turn-memory"`, `phase` equal to the window id, and `category` `project`. Jev unavailable, below threshold, empty extraction, or a secret-bearing body does not call it.
- [x] The handler never calls `sendUserMessage` or a turn-triggering `sendMessage`. A thrown or hung dependency does not escape the handler.
- [x] Importing the hook factory with `SQL_MEMORY_URL` unset does not load `pg`.
- [x] `docs/sql-memory.md` no longer claims there is no auto-writer. The how-to off switch is the documented opt-out, and its **Eat** matches the enablement tests.
- [x] `/extensions` in an OMP session that loads this package lists `hooks/post/turn-memory.ts` once.

## Verification

- `npx vitest run extensions/turn-memory/__tests__`
- Import smoke: factory load without `SQL_MEMORY_URL` does not resolve `pg`.
- When `SQL_MEMORY_URL` is set in a throwaway repo: three short prompts that contain one explicit decision produce one new active memory row; a fourth prompt does not; `BUCK_TURN_MEMORY=0` in a new session produces none. Skip this live check if the URL is unset, and say so. Do not treat a missing URL as a passed live write.
- After the code lands, `/b-guardrails-check` at a coherent point. This plan does not run it.

## Risks

- Covered in Material Risks. Additional: a 0.70 threshold will drop weak-but-real facts. That is the chosen bias for an on-by-default writer. Do not lower it to make the first smoke save something.
- Package discovery loads the hook in every project that loads buck-workflow, not only this repo. Opt-out must work from the project `.omp/settings.json` of the session cwd, not only from this checkout.

## Execution note

This plan is over the phasing threshold: more than five files, a trust-boundary write, and a Jev plus SQL plus hook split. Run `/skill:b-phase` before `/b-build`. Do not start the unsplit build from this file.
