---
date: 2026-09-12
domains: [review, workflow, extensions, testing]
topics: [fix-pr, pr-20, b-save, coderabbit, rebase, conflict-resolution]
related: [extensions/b-save/index.ts, extensions/omp-models.ts, extensions/omp-model-session.ts, .context/workflow/current-session.json]
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts: [extensions/omp-models.ts, extensions/omp-model-session.ts, .context/workflow/current-session.json, .context/2026-09-10.b-save-state-machine-analysis/parity-checklist.md, .context/2026-09-10.b-save-state-machine-analysis/research/notes-b-save-state-machine.md]
---

# PR #20 CodeRabbit set + master rebase

User-cited Wooderson blockers (executeRun wiring, continueFrom resume) were
re-validated at `86f92f7`: both `already_done` — fixed in `4daa716`, verified by
12/12 `command.test.ts` and 53/53 `extensions/b-save` at HEAD. The user then
scoped the pass to the standing CodeRabbit `CHANGES_REQUESTED` (18 comments at
`4daa716`).

## Validation of the 18 CodeRabbit comments

14 were `already_done` by `f785ff6` ("restore checkpoint persistence contract",
which landed AFTER CodeRabbit reviewed `4daa716`):

- apply.ts: moves rejected pre-journal; resume throws on missing staged tmp;
  rollback verifies stored after-image hashes before reverting
- evaluate.ts: memory path under `.context/memory/`; `checkpointPatch` composes
  full contract (cross-refs, spec/phase/iterate status, backlog archive/create,
  subject index, loose-artifact moves as journaled write+delete pairs);
  `subjectFiles` resolves bare artifact names against subject path
- snapshot.ts: `redactUntrusted` consumes `_-` suffixes (test asserts suffix
  absent); `resolveSubject` rechecks normalized-name existence
- roles.ts: per-claim `{id,quote}` citations schema + verbatim
  `validateEvidenceCitations` pre-evaluation
- index.ts: `resumeRun` returns `completeRecoveredApply` directly after journal
  recovery (no re-snapshot/re-apply)
- omp-model-session.ts `enableIrc: opts.enableIrc ?? false` + test;
  package.json moved `@mariozechner/pi-coding-agent@0.73.1` to dependencies;
  deprecated-b-save Step 9 skip wording; skills/b-loop "Surfaces" reference;
  docs/extension-loading.md package tree


Fixed in this pass (commit `7fd7b5a`, `docs(context)`):

- current-session.json `buck_workflow_mode_reason` described the b-kickoff
  prompt; now describes the issue #23 engine repair the record reflects
- parity-checklist: `status: completed`, live proof = recorded `--run-id` +
  registration tests, interactive OMP TUI check non-blocking, "cutover waits
  on live OMP evidence" removed
- research notes: Hindsight architecture Q&A outcome corrected to the locked
  decision (nested-agent fallback rejected; rule 8 `unsupported`)

`out_of_scope`: plan-b-pr-manager.md polling wording — different subject's
historical plan, implemented on the `feat/agent-manage-pr` branch.

## Rebase onto master (`31a1379`)

15-commit rebase, 5 conflict groups:

- `extensions/omp-models.ts`: master (PR #19/#24) added ActivityEvent +
  onActivity/timeoutMs to the inline `runOmpModelSession`; branch had replaced
  it with a re-export from `omp-model-session.ts`. Resolution: keep the
  re-export; ported master's `onActivity` subscribe/normalize bridge +
  `ActivityEvent` import into `omp-model-session.ts` (timeoutMs already there).
- `b-save-improved/{index.ts,handler.test.ts}`: branch deletion wins over
  master's live-activity edits (subsystem removed by cutover).
- `command-progress.test.ts`: master deleted it (superseded by
  `extension-activity.*`); branch's 10-line edit moot → deleted.
- `.context/memory/index.md` (x2): both-added-at-top ledger entries, merged
  date-ordered (fix-pr-24, fix-pr-20-checkpoint-contract, extension-activity,
  fix-pr-20-issue23).

## Verification

- `npx vitest run` (full): 41 files, 528/528 pass
- `npx vitest run extensions/b-save`: 53/53 pass
- Scoped `tsc --noEmit`: the 4 hits under `omp-model*`/`b-save/` are byte-identical
  pre-existing diagnostics at `86f92f7` (untyped `isolationExtras(opts)`,
  types.test.ts manifest shape, hindsight-guarded-retain experiments) — not
  introduced by this pass

Pushed `79849b1` (force-with-lease after verified rebase; branch was already
rebase-managed). `mergeStateStatus` DIRTY → CLEAN.

Wooderson posted a post-push review at `79849b1` (18:38:58Z): "No new findings
in this delta"; blockers re-confirmed resolved. CodeRabbit was review-rate
limited at push time; its 18 comments were individually validated above.
Guardrails: vitest 528/528, lines 78.06% (min 60 / target 75 / ratchet 54.9),
patch coverage 91% (min 90), lizard CCN ≤ 10 on touched files.
