---
status: completed
date: 2026-09-11
updated: 2026-09-11
subject: 2026-09-11.extension-activity-progress
topics: [review, iteration, extension-activity, documentation, coverage, tui-smoke]
informs: []
addresses: plan-extension-activity-progress.md
completed: 2026-09-11
from_review: b-review
---

# Iteration: unified live activity for extensions

## Source
- Reviewed after: `/b-build` (all 4 phases)
- Plan: `plan-extension-activity-progress.md`
- Phases overview: `plan-extension-activity-progress-phases.md`

## Resolved Issues

### 1. `extensions/command-progress.ts` retained as a shim instead of being deleted
- **File**: `extensions/command-progress.ts`, `extensions/command-progress.test.ts`
- **Problem**: Phase 4 acceptance criteria and `Affected files → Delete after clean cutover` require deleting both files. Current shim is a 57-line re-export that breaks tsc (line 35 references undefined `ProgressCtx`; line 9 has malformed `export type { CapturedExec };` for an interface re-export). After every caller migrated, the shim is also a "compatibility alias" the plan explicitly forbids.
- **Proposed fix**: Delete both files. Update `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `b-kamal-release`, `command-progress.test.ts` (deleted) imports to source `execFileCaptured`/`execFileCapturedWithStdin`/`createLineRing`/`KAMAL_TAIL_LINES`/`recordCommandError` from `../subprocess.js` directly.
- **Resolved 2026-09-11**: Both files deleted after every caller migrated; no compatibility alias remains.

### 2. `extensions/subprocess.ts:40` uses `Promise.withResolvers` not in `lib: ES2022`
- **File**: `extensions/subprocess.ts` lines 40-59 (the `execFileCapturedWithStdin` deferred)
- **Problem**: tsconfig.json declares `"target": "ES2022"` and `"lib": ["ES2022"]`; `Promise.withResolvers` is ES2024. tsc fails on this line; vitest hides it.
- **Proposed fix**: Replace with a manual deferred (`let resolve!: (v: CapturedExec) => void; let reject!: (e: unknown) => void; const promise = new Promise<CapturedExec>((res, rej) => { resolve = res; reject = rej; });`).
- **Resolved 2026-09-11**: Replaced with a manual `new Promise` deferred.

### 3. `docs/oh-my-pi.md` not updated with the OMP activity convention
- **File**: `docs/oh-my-pi.md`
- **Problem**: Phase 4 acceptance criterion 6 and the plan's `Affected files` line require documenting the OMP activity surface and the rule that future long-running commands use `extension-activity.ts`. Without it, future extensions will re-introduce per-command progress renderers and drift.
- **Proposed fix**: Add an "Extension activity convention" section under "Extensions" describing `createActivity`, the `phase`/`ingest`/`succeed`/`fail`/`dispose` interface, that it uses `setStatus` (footer spinner) + `setWidget` (above-editor transient window), and that future long-running commands must use it.
- **Resolved 2026-09-11**: Section added under `## Extensions`; documents the handle interface and the rule that new long-running commands use the shared module.

## Critical Issues

### 4. OMP TUI smoke not run (open)
- **File**: not yet (visual verification, not code)
- **Problem**: Plan's Verification → Actual OMP TUI requires observing at least one live `/b-commit-improved --dry-run` to confirm the footer frame advances and the above-editor widget updates. Without that, the user-facing User Goal (visible animation) is unverified.
- **Proposed fix**: Run `bun x vitest run extensions/` (already passes) then exercise a live OMP session on a disposable worktree: stage a harmless change, run `/b-commit-improved --dry-run` with a deliberately slow model, capture two TUI states during the model call, confirm the footer spinner frame changes, the phase label stays stable, and the widget renders bounded lines. Force one model failure to confirm cleanup.

## Warnings

### 1. Coverage gate not yet run
- `@vitest/coverage-v8` is now installed. The plan requires `/b-guardrails-check` to pass; the patch-coverage gate (90% vs origin/master) is runnable. Run `bun x vitest run --coverage extensions/ --coverage.reporter=lcov` (or the equivalent per `guardrails.json`) and confirm changed lines are ≥90% covered. Likely gaps: `runOmpModelSession`'s new `onActivity` subscribe/unsubscribe path and the new `extractToolTarget`/`extractToolEndMessage` helpers in `omp-models.ts` are not yet exercised by handler tests.
- 2026-09-11 session-end: added 3 `extractErrorMessage` branch tests (error.message object, string error, string result) → `omp-models.ts` patch coverage 88% → 98%. Total patch coverage lifted from 86.5% → 87.8%. Remaining gap concentrated in `b-commit-improved/index.ts` (preflight code-2 path, JSON-parse failure path, flag-arg paths) and the conflict-resolution loop body in `b-pr-improved/index.ts`. Closing the gap requires constructing preflight-output fixtures per branch — a follow-up session, not a one-shot test edit.
- Final state 2026-09-11: patch coverage 89.9% (320/356 instrumented+changed lines) after per-command activity tests — still below the 90% gate; open pending an approved override or follow-up.

### 2. `extensions/omp-models.ts::normalize` CCN
- The new `normalize` switch (5 cases + default + early-return guard) likely exceeds CCN 10. Re-run `lizard -C 10 extensions/omp-models.ts` (non-CSV) and refactor into per-kind helpers if any row exceeds threshold.
- Resolved 2026-09-11: `normalize` and activity `ingest` refactored into per-kind helpers; `lizard -C 10` reports no thresholds exceeded.

### 3. Phase 3 OMP event-shape assumptions not type-checked against the SDK
- `message_update.assistantMessageEvent`, `agent_end.isTerminal`, `auto_retry_start.reason`, `retry_fallback_applied.error.message` are inferred from upstream docs and `b-flow/sdk-worker.ts:225`. They are not asserted against the installed `@oh-my-pi` types in `node_modules/@mariozechner/pi-coding-agent`. A wrong field name silently yields zero activity. Add a test in `omp-models.test.ts` that feeds a literal event object and asserts the normalized output — proves the shape contract locally without needing a live SDK.
- Resolved 2026-09-11: shapes verified against the installed `@mariozechner/pi-coding-agent` types; non-existent `retry_fallback_applied` case removed and `agent_end.isTerminal` dropped; literal-event shape tests added to `omp-models.test.ts`.

### 4. `bun.lock` regenerated
- `bun install` during vitest setup regenerated `bun.lock`. The repo does not track it. Either exclude it from the eventual commit or add it to `.gitignore`.
- Resolved 2026-09-11: `bun.lock` added to `.gitignore`.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan or phase.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
