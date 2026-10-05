---
status: completed
date: 2026-10-02
subject: 2026-09-30.buck-loop-tui-preview
topics: [buck-loop, jev, judgment, model-routing, singleton-choice]
informs: []
related: [research-singleton-choice-return.md]
---

# Diagnosis: singleton continuation sent to Jev through chat completions

Jev is appropriate for native bounded judgment. The recorded error came from the Buck choice-stage chat fallback, not a failed native Jev evaluation. The follow-up singleton repair is recorded in [research-singleton-choice-return.md](research-singleton-choice-return.md); settings, staging, commits, receipts, and loop state remain untouched.

## Recorded execution

- `.context/workflow/buck-loop.json` remains `blocked`; the last transition was `saving -> blocked` at `2026-10-02T03:50:20.861Z`. Its reason lists unstaged non-`.context` changes. The earlier `saving -> saving` entry records an ambiguous postcondition scan.
- `transition-audits/1790913020177-jev-1-ce873bd8-98dc-4761-89a6-440e54e2977b.json` has exactly one legal action, `retry`, with `accepted: false` and `reason: Jev choice needs at least two continuations.` No native API response was produced for this continuation question.
- `transition-audits/1790913020856-profile-1-8fc5d427-7bfb-4ca1-b083-f459d5cc93cc.json` records the same singleton and a rejected profile call with HTTP 400 `ModelProtocolUnsupported`.
- The captured HTTP request at `/home/buckleyrobinson/.omp/logs/http-400-requests/1790913020829-1gcdymkzbhq5k.json` identifies provider `opencode-zen`, API `openai-completions`, model `jev-1.13`, and `POST https://opencode.ai/zen/v1/chat/completions`. Its body contains `model`, `messages`, `stream`, and `stream_options`, rather than native `state` and `questions`. Headers and message content are deliberately not reproduced here.

## Historical failure cause

At the recorded revision, `extensions/buck-loop/choice.ts:146-148` rejected fewer than two options before contacting native Jev. `choose()` had no singleton branch: after `askJev()` rejected it, execution fell through to `attemptChoice()` and `callChoiceModel()`. That route used `runOmpModelSession()` with the selected Buck choice-stage model. The helper created a coding-agent session and prompted it for text.

Consequently, a deterministic one-option continuation was unnecessarily modeled, and Jev was then invoked with an unsupported chat protocol. The provider's refusal was correct for the request that was sent. The subsequent singleton repair removes that call for a sole action; multiple-choice routing is outside this repair's scope.

The Buck `choice` stage is resolved independently of OMP's general `modelRoles`: `selectBuckStageModel()` reads project/global Buck profile configuration (`extensions/buck-loop/run-step.ts:326-365`). Naming the stage `choice` does not make its chat session a TypeSafe Choice request. The global configuration explicitly lists `opencode-zen/jev-1.13` under `choice.models` (`~/.omp/agent/config.yml:146-148`): that assignment is incompatible with the current chat fallback. Jev remains appropriate for native judgment.

The proximate blocking failure was the HTTP 400, not the unstaged-file refusal recorded in the projection. `haltInCycleBlock()` (`extensions/buck-loop/loop.ts:1047-1058`) replaces the last transition's `why` and returned reason with the unstaged-file list when an in-cycle block occurs in a dirty checkout. The failed `closed-set-choice` activity and the `saving -> blocked` transition share timestamp `2026-10-02T03:50:20.861Z`. Preserve both facts: the model/protocol mismatch triggered this block; unstaged files remain a separate resume/commit gate.

## Initial diagnostic smoke

Ran the actual stage resolver without starting a work session or resuming the loop:

```sh
bun -e 'import { selectBuckStageModel } from "./extensions/buck-loop/run-step.ts"; const result = await selectBuckStageModel({ cwd: process.cwd(), stage: "choice", skill: "choice", context: { continuation: "Read-only diagnosis of the recorded singleton retry decision" } }); console.log(JSON.stringify(result)); if (!result.ok) process.exitCode = 1;'
```

Observed output:

```json
{"ok":true,"id":"opencode-zen/jev-1.13","thinking":"off"}
```

Exit 0. The failed chat request was not reissued. This initial diagnostic step changed only the Markdown record; implementation and fresh checks are recorded below and in the linked repair record.

## Repair implemented

- `choose()` now filters operator-only `block`, preserves the empty-set rejection, and returns a singleton before resolving any model. It uses the existing `ChooseResult` shape, writes an accepted `sole` audit first, emits the local reason, and blocks if the audit cannot be written.
- The shortcut belongs at the public chooser boundary, not in `askJev()`: deterministic selection needs neither a model nor an audit falsely attributed to Jev. No class or abstraction was added.
- `askJev()` and multiple-choice routing remain unchanged. Jev is appropriate for native judgment, not chat completions; a separately authorized multi-choice routing change would be needed to remove the existing chat fallback.
- Regression evidence, real no-model smoke, and the passing durable guardrails contract are recorded in [the completed singleton repair record](research-singleton-choice-return.md).
- The native request contract is `state` plus typed `questions`; the live TypeSafe API reference documents `POST /v1/systemone`: <https://docs.typesafe.ai/api.md>.

## Independent save and operator gates

The singleton fix returns only a machine-approved continuation; it does not verify a save or remove the bounded retry ceiling. The SQL-save ambiguity has separate concrete evidence:

- `.context/workflow/sql-save-attempt.json` records attempt `190ee6c4-6215-4e2e-ad94-73c37ad22245`, run `5cbd82ce-dafb-40ba-bfd0-792e08b4aec7`, and canonical subject `2026-09-30.buck-loop-tui-preview`.
- The matching filename under `sql-memory-receipts/` contains `completed: true` and the same attempt/run IDs, but its subject is `2026-09-30.buck-loop-tui-preview stacked-cards live integration`.
- `sameAttempt()` in `extensions/buck-loop/sql-save.ts:327-333` requires an exact subject match. `receiptShape()` therefore returns `unverified`; `loop.ts:700-709` passes that result to the scan, and `scan.ts:479-484` leaves saving ambiguous. This is receipt verification failure, not evidence of a database connectivity failure.
- `saveDirective()` supplies attempt/run/project/phase/receipt fields but omits the subject. This omission is an observed producer-contract gap; it is not repaired by the chooser change.
- `machine.ts` intentionally opens the SQL-save continuation boundary even for a sole retry. Its `applyChoice()` legal-action validation, save-to-commit confirmation guard, and one-retry ceiling are unchanged. No receipt, machine, or workflow state was edited.

The unstaged assignment changes were not all unexplained pre-existing dirt. Earlier build/iterate/docs children staged assignment files; the save child then ran `git reset && git add <the SQL receipt> && git diff --cached --name-only` at `2026-10-02T03:50:17.051Z`, clearing those earlier staging decisions. The unrelated `extensions/buck-loop/machine.ts` change remains a distinct blocker.

`prepareCommitCheckpoint()` still rejects out-of-scope unstaged non-`.context` paths, and the active plan declares no `files:` field. The singleton repair owns changes in `extensions/buck-loop/__tests__/choice.test.ts` and `docs/CHANGELOG.md`, plus its own hunks in `extensions/buck-loop/choice.ts`; those are not automatically TUI-preview assignment changes. The chooser file also contains assignment-owned hunks. The operator must either commit the repair separately with hunk-level selection for `choice.ts`, or deliberately include the repair in the loop checkpoint. Preserve the unrelated machine change. No stash, stage, or commit was performed during this repair.

`permitsBlockedStagedResume()` bypasses the dirty-tree prompt only when every non-`.context` change is staged-only. Acceptance must come from verification evidence, not mechanically checked boxes. The run remains blocked; restarting OMP and `/buck-loop --resume` are operator actions, not actions performed here.
