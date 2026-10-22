---
status: active
date: 2026-10-16
subject: 2026-10-16.buck-loop-restart-test-fingerprint
topics: [buck-loop, extension-restart, diagnose]
research: []
iterations: []
memory: []
---

# Plan: Ignore test-only buck-loop edits in the restart gate

## User Goal

An operator whose diagnose-and-fix session only edits buck-loop tests should keep that repair and continue. A session that edits the loaded supervisor still stops until OMP restarts.

## Goal

`Restart OMP before continuing` fires only when a non-test file under `extensions/buck-loop/` changes during a retry or diagnose session. A test-only diff does not block, does not set the process-local restart gate, and does not skip the diagnose rescan.

## Context used / assumptions

- User-provided context: monitor the storage-adapter omp tab; if the loop errors and the cause is buck-workflow, write a plan in this repo.
- Session context: the live run in `/home/buckleyrobinson/projects/development_tools/storage-adapter.wt` was diagnosing phase 8. At `2026-10-16T16:53:57.081Z` it transitioned `diagnosing -> blocked`. The saved reason listed only `extensions/buck-loop/__tests__/fixtures.ts`, `extensions/buck-loop/__tests__/loop.test.ts`, and `extensions/buck-loop/__tests__/persist.test.ts`.
- Code: `loopExtensionFiles()` hashes every file under `extensions/buck-loop/`. `executeDiagnose()` and `retryRepair()` call `stopForExtensionRestart()` when that fingerprint changes. `restartRequired` then refuses same-process `start` and `resume`.
- The only `extensions/buck-loop` import of `__tests__` is from `index.test.ts`, which is itself a test. The running supervisor does not load those files.
- Synthesized user goal from the operator request. Refine the wording if the beneficiary should be someone other than the operator of the live loop.
- Assumption: this is a new subject. The diagnose-halt subject stays the record of the earlier feature, not the owner of this defect.

## Decision Closure

Selected course: subtract test paths from the loaded-extension fingerprint. Keep the existing stop, warning text, and process-local resume gate for every other path under `extensions/buck-loop/`.

Evidence: the live block named only `__tests__` files. `ambiguity.ts` `loopExtensionFiles()` records every file. `loop.ts` `executeDiagnose()` treats any fingerprint change as a loaded-code repair. OMP keeps the already-imported supervisor until process restart; test files are not those imports.

Excluded scope: recovering the storage-adapter tab, narrowing the diagnose prompt, auto-restarting OMP, and dropping markdown or JSON from the fingerprint.

Next action: implement the filter and the two regressions below. Do not resume the live storage-adapter loop from this process.

## Assumptions Ledger

| id | statement | status | blocking | evidence | validation_path |
|---|---|---|---|---|---|
| A-1 | The running supervisor does not import `__tests__/` or `*.test.*` / `*.spec.*` modules. | validated | false | `extensions/buck-loop/index.test.ts` is the only importer of `__tests__/fixtures.js`, and that file is a test. | — |
| A-2 | Skipping tests does not hide a simultaneous runtime edit. | deferred | false | The filter is subtractive; runtime paths stay in the map. | Mixed-diff test in `extensions/buck-loop/__tests__/loop.test.ts` during build. |

## Material Risks

| failure_mode | impact | mitigation | rollback_or_fallback | validation_path |
|---|---|---|---|---|
| A loaded module is classified as a test and the loop continues on stale supervisor code. | Same-process review or rescan runs the old extension after a real repair. | Exclude only a `__tests__` directory segment and `*.test.*` / `*.spec.*` basenames. Any other path still calls `stopForExtensionRestart()`. | Revert the filter in `loopExtensionFiles()`. The all-files fingerprint and process-local gate return. | Existing `touched.ts` restart test must still block and refuse same-process `resume`/`start`. The new mixed-diff test must name the runtime file in the restart reason. |

## Scope

- Stop hashing test files in the extension restart fingerprint.
- Prove test-only diagnose edits continue, and mixed test-plus-runtime edits still restart.
- Say that distinction in the resume how-to.

## Out of scope

- Restarting or resuming the blocked storage-adapter omp tab.
- Changing the diagnose handoff so the child cannot edit `extensions/buck-loop/`.
- Changing the restart reason string or the process-local gate.
- Ignoring markdown, JSON, or other non-test files under `extensions/buck-loop/`.
- The never-invent checkpoint rule.

## Affected files

- `extensions/buck-loop/ambiguity.ts` — skip test paths in `loopExtensionFiles()`.
- `extensions/buck-loop/__tests__/loop.test.ts` — test-only and mixed-diff regressions.
- `docs/howto/resume-buck-loop-after-repair.md` — the stop is for a non-test file, not any file under that directory.

## Implementation steps

1. In `loopExtensionFiles()`, do not descend into a directory named `__tests__`. Do not hash a file whose basename matches `*.test.ts`, `*.spec.ts`, `*.test.js`, `*.spec.js`, `*.test.mjs`, or `*.spec.mjs`. Leave `changedLoopExtensionFiles()` as a before/after hash compare.
2. Add a heavy-lift diagnose regression beside the existing diagnose tests. The child writes only `extensions/buck-loop/__tests__/fixtures.ts` and `extensions/buck-loop/index.test.ts`. The result must not match `Restart OMP`. Same-process `resume` must not repeat a restart reason. The diagnose result must still be the child outcome, not a restart halt.
3. Add a mixed regression. The child writes that test file and `extensions/buck-loop/touched.ts`. The result is `blocked`, the reason matches `Restart OMP before continuing`, and the reason contains `extensions/buck-loop/touched.ts`. Same-process `resume` and `start` return that same reason and do not call the skill again.
4. Leave the existing `prior.ts` and `touched.ts` restart tests unchanged. They must still pass.
5. Change the opening line of `docs/howto/resume-buck-loop-after-repair.md` so it says the stop follows a non-test change under `extensions/buck-loop/`, not every change under that directory.
6. Run the focused loop tests and `npm run guardrails:check`.

## Acceptance criteria

- [x] A diagnose session that changes only test files does not warn or block with `Restart OMP before continuing`.
- [x] That test-only session does not set the process-local restart gate.
- [x] A diagnose or retry session that changes a non-test file under `extensions/buck-loop/` still blocks, names that file, and refuses same-process `start` and `resume`.
- [x] A mixed test-plus-runtime diff still blocks on the runtime file.
- [x] `docs/howto/resume-buck-loop-after-repair.md` describes the non-test rule.
- [x] Focused Vitest for `extensions/buck-loop/__tests__/loop.test.ts` passes, and `npm run guardrails:check` does not fail a required gate.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/loop.test.ts`
- `npm run guardrails:check`
- Confirm the existing runtime restart tests still expect `Restart OMP` for `prior.ts` and `touched.ts`.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:

1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces out-of-plan issues, do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from this plan.

## Risks

- The live storage-adapter projection is already `blocked` with the false restart reason. This plan does not clear that bookmark. A fresh OMP process does not inherit the in-memory gate; resume still has to be an explicit operator action in that checkout.
- A runtime module checked in under `__tests__/` would no longer trip the gate. Do not put loaded supervisor code there.
