---
status: completed
date: 2026-09-20
subject: 2026-09-20.review-loop-state-machine-alignment
topics: [state-machine, code-review-iteration, migration, architecture, refactor]
research: []
iterations: []
memory: [review-loop-state-machine-build-2026-09-20.md]
---

# Plan: Migrate code-review-iteration decisions onto the pure evaluator

## User Goal

Engineers running `/code-review` get a review loop whose lifecycle decisions are centralized in one truth-table-testable rule set sharing the same fail-closed vocabulary as `/buck-loop`'s machine — with zero observable behavior change, zero migration risk to in-flight runs, and no new orchestration runtime.

## Goal

Replace the seven scattered control-flow decisions in `extensions/code-review-iteration/loop.ts` with an explicit ten-state machine declared over `defineMachine()` (`extensions/state-machine.ts`), keeping `loop.ts` as the sole effect supervisor. Decision layer only: no schema bump, no scan/persist split, no events.

## Evidence base

All line references verified at HEAD `fb8f469` (2026-09-20). **The evaluator seam is uncommitted:** `extensions/state-machine.ts`, `extensions/buck-loop/machine.ts`, and both buck-loop test files are modified in the working tree (364→441 lines, JSDoc added, semantics unchanged), and `docs/state-machine.md` is untracked. References are to the working-tree files, not to `fb8f469`. Commit that seam before step 1 — a `git checkout`/`stash` would delete the contract this plan builds on.

**Current decisions (the migration contract) — `extensions/code-review-iteration/loop.ts`:**

| # | Decision | Evidence |
|---|---|---|
| D1 | Catalog preflight fail → `failed` | `loop.ts:606-612` (`initializeRun`), surfaced by test "terminalizes a resumed run on disk when catalog preflight fails" |
| D2 | Base prep: no base / fetch fail / rebase unresolved → `failed`; else continue | `loop.ts:171-175`, `195-204`, `205-216` (`prepareBaseAndCheckpoint`), `"continue"` sentinel at `218` |
| D3 | Resume position = review.json present ∧ fixer.json absent | `loop.ts:679-687` (`resumeIncompleteFixer`), test "resumes an incomplete fixer pass instead of skipping it" |
| D4 | Zero blocking → `clean`; blocking + no hardness → `failed`; else fixer | `loop.ts:637-648` (`resolveReviewedPass`, `blockingFindings` 115-117, `maxBlockingHardness` 646-647) |
| D5 | `checks.passed` → checkpoint + next pass; else → `blocked` | `loop.ts:462-467` (checkpoint gate), `667-674` (`runFixerForPass` blocked branch), test "blocks when deterministic checks fail after a fixer pass" |
| D6 | Exhaustion via `while` fall-through | `loop.ts:715-724`; fixer still runs on final pass (D4→D5 fire at `pass == max`), test "ends exhausted when blocking findings persist to the pass bound" |
| D7 | `cancelled` vs `failed` by exception type | `loop.ts:725-728` (catch-all, `LoopCancelledError` 61-66), test "ends cancelled when the reviewer session is cancelled mid-pass" |

**Durable state being preserved — `extensions/code-review-iteration/run-state.ts`:** `RUN_STATE_SCHEMA = 1` (`:15`), `RunStatus` six values (`:17`), `RESUMABLE_STATUSES` (`:20`), `RunState` fields (`:49-72`), `findResumable` newest-first (`:162-168`), `validateResume` head/fingerprint/git-op checks (`:175-196`), atomic `saveState` (`:114-121`), pass layout `passes/NN/` (`:101-103`).

**Evaluator contract — `extensions/state-machine.ts`:** purity header (`:1-7`, `:165-199`); 13 `MachineFailureCode`s (`:9-22`); `MachineFailure` with `code`+`context` (`:48-56`); `defineMachine` (`:200-362`): `advance` selects exactly one enabled automatic rule or returns legal choices or throws `NO_ROUTE` (`:286-306`), `AMBIGUOUS_AUTOMATIC` on two enabled guards (`:253-258`), `TERMINAL_STATE` refusal (`:288-290`), `INVALID_TARGET` (`:227-231`); `choose`/`send` unused here (compile to `never`).

**Production precedent:** `extensions/buck-loop/machine.ts` defines `buckMachine` over the same evaluator (`:542-622`), with `next()`/`applyChoice()` wrappers (`:644-651`), iterate ceiling constant (`:11`); supervisor pattern `extensions/buck-loop/loop.ts` (`drive` `:238-258`, `takeStep` `:267-285`, disk-wins `rescan` `:654-679`); vocabulary in `types.ts` (`LoopState` `:35-46`, `Choice` `:129-135`, `Effect` `:198-202`).

**Behavior contract:** `extensions/code-review-iteration/__tests__/loop.test.ts` — 24 scenarios (`describe("runReviewLoop")` at `:215`) exercising real origin/clone pairs; all must pass **unmodified**.

**Seam invariants:** `.context/2026-09-19.reusable-state-machine/plan-reusable-state-machine.md` — core invariants `:73-81` (flat, pure, synchronous, ambiguity-is-error, opaque outputs); "false reuse" risk `:172`; code-review-iteration migration explicitly deferred there (out of scope `:107`).

**Design artifact:** `report-architecture-alignment.html` in this subject — figures, 10-dimension comparison, §05 behavior map (the rule inventory this plan implements), alternatives, risks.

## Context used / assumptions

- User context: "b-plan the migration with references to evidence" — evidence-first plan requested; report direction (decision layer only, derive-no-bump) implicitly accepted by proceeding to plan.
- Session context: full report produced this session; subject already initialized/activated.
- Assumption 1: machine state is **derived, never persisted** — but facts are **hybrid**, not disk-only: `catalogOk`, `baseReady`/`baseError`, `reviewError` are in-session effect results with no on-disk marker (nothing records catalog preflight or base readiness). `stateOf(facts)` must therefore be a total function of optional fact fields where *absent ⇒ earlier phase*, so a fresh resume (all in-memory fields undefined) projects to `initializing` and re-runs preflight + base prep — exactly today's `initializeRun` behavior. Only D3's position (`review.json` present ∧ `fixer.json` absent ⇒ `triaging`) comes from disk, via the reads `resumeIncompleteFixer` already performs (`loop.ts:680-684`). No schema bump; in-flight runs stay resumable.
- Assumption 2: cancellation stays an exception-typed boundary concern (D7 unchanged); routing through `machine.send()` is deferred (report §07).
- Assumption 3: `MachineFailure` is unreachable for a well-formed projection; if it fires, supervisor converts to `failed` with `code` + `context` in the terminal reason — mirroring `/buck-loop`'s fail-closed conversion.
- Assumption 4: `LoopDeps` (`loop.ts:68-89`), `LoopOptions` (`:91-103`), `LoopResult` (`:105-109`) are frozen; no caller changes.

## Scope

- Add `extensions/code-review-iteration/machine.ts`: `ReviewState` (10 states: `initializing`, `preparingBase`, `reviewing`, `triaging`, `fixing` + terminals `clean`, `blocked`, `exhausted`, `failed`, `cancelled`), `ReviewFacts`, `ReviewOutput`, `reviewMachine` with named automatic rules covering D1–D6.
- Add a pure `project()` facts builder: `RunState` + pass-artifact presence + already-computed effect results → `ReviewFacts`. It also derives the triage facts (`blocking` count, `hardness`) via `blockingFindings`/`maxBlockingHardness`, so `triaging` rules are guards over facts and need no effect of their own.
- Keep `tryResume` (`loop.ts:605`) and run creation (`:614-620`) as pre-machine bootstrap in `runReviewLoop`: a `RunState` must exist before any projection. They are not machine effects and appear in no §05 row.
- Rewire `loop.ts` to: project → `advance()` → interpret `output.effect` → persist → repeat. Collapse D1–D6 branches into effect executors; single terminalize path fed by `terminal` outputs.
- Truth-table tests for every rule + failure-mode pins.

## Out of scope

- No `choose`/`send` usage; no operator choices, no machine events (D7 stays at the boundary).
- No `RunState` schema change, no persistence of machine state, no `validateResume` changes.
- No changes to `git-ops.ts`, `policy.ts`, `findings.ts`, `rubric.ts`, `catalog.ts`, `prompts.ts`, `personas/`, `prompts/`, `report.ts`, `frontmatter.ts`, `index.ts`.
- No modification of the 24 integration scenarios; a needed edit = behavior change = stop and re-plan.
- No buck-loop changes; no evaluator (`state-machine.ts`) changes; no new dependencies.

## Affected files

### Create
- `extensions/code-review-iteration/machine.ts` (~220 LOC) — types, `project()`, `reviewMachine`.
- `extensions/code-review-iteration/__tests__/machine.test.ts` — truth table + pins.

### Edit
- `extensions/code-review-iteration/loop.ts` — D1–D6 branches replaced by machine dispatch; `resumeIncompleteFixer` (`:679-687`) deleted (subsumed by projection); `resolveReviewedPass`/`runFixerForPass` reduced to effect executors; terminal reasons now originate in rule outputs.

### Untouched (explicit)
- `run-state.ts` (`RUN_STATE_SCHEMA` stays `1`), `loop.test.ts` (zero diff), all modules listed in Out of scope.

## Implementation steps

1. **Freeze the contract.** Commit the working-tree evaluator seam (`state-machine.ts`, `buck-loop/machine.ts` + its two test files, `docs/state-machine.md`) so the migration targets a committed contract; re-read any moved line; run the integration suite for a baseline green; transcribe the report §05 map (14 rows) into a failing `machine.test.ts` skeleton (TDD red).
2. **Declare types.** `ReviewState`, `ReviewFacts` (`pass`, `maxPasses`, `catalogOk?`, `baseReady?`, `baseError?`, `review? {blocking, hardness}`, `reviewError?`, `fixer? {checksPassed}`), `ReviewOutput` (`run-catalog-preflight` | `prepare-base` | `run-reviewer-pass` | `run-fixer-pass` | `terminal {status, reason}`); `choiceKey`/`eventKey` typed `never`. No `triage-findings` output — triage is a pure decision over facts, not an effect.
3. **Declare rules** with mutually exclusive guards named per the behavior map (`preflight-ok`, `preflight-failed`, `base-ready`, `base-failed`, `review-parsed`, `review-failed`, `triage-clean`, `triage-uncomputable`, `triage-to-fixer`, `fixer-continue`, `passes-exhausted`, `fixer-blocked`); five states `terminal: true`. Guards must be self-disjoint — the evaluator has no declaration-order tiebreaker (`state-machine.ts:253-258`), so each guard carries the negation of its siblings (e.g. `review-parsed` requires `reviewError == null`).
   Green the truth table in two layers:
   - **Row layer:** each §05 row asserted as rule id + `to` + `output` (14 rows), plus `AMBIGUOUS_AUTOMATIC`, `NO_ROUTE`, `TERMINAL_STATE`, and `INVALID_TARGET` pins asserted on `error.code`, never message text (`state-machine.ts:40-47`).
   - **Exclusivity layer:** enumerate the full `ReviewFacts` cartesian product over its finite domains — `pass ∈ {1, maxPasses-1, maxPasses}`, `catalogOk ∈ {undefined, false, true}`, base ∈ {neither, `baseError`, `baseReady`}, `review ∈ {undefined, blocking 0, blocking≥1 + hardness, blocking≥1 + null hardness}`, `reviewError ∈ {undefined, set}`, `fixer ∈ {undefined, passed, failed}` — and for every combination assert `advance()` either returns exactly one decision or throws `NO_ROUTE` for a combination named in an explicit unreachable-allowlist constant. This proves ambiguity-freedom instead of sampling it, and a future guard edit that opens a hole fails the test rather than hiding.
4. **Implement `project()`.** Pure function over `(RunState, options.minBlocking, pass-dir reads already performed by `readJsonIfExists` at `loop.ts:538-544`)`: review present ∧ fixer absent ⇒ `triaging` (D3), both present ∧ `checks.passed` ∧ `pass < max` ⇒ `reviewing`, both present ∧ ¬passed ⇒ `blocked`, etc. Blocking/hardness derived here with `findings.ts` (pure — imports only `rubric.js`).
5. **Rewire the supervisor.** `runReviewLoop` (`:704-729`) keeps its guard (`:705-708`) and try/catch (`:725-728`); the body becomes project → advance → execute output with today's exact functions (`prepareBaseAndCheckpoint`, `runReviewerPass` `:321-339`, `runFixerPass` `:435-469`, `writeTerminalReport` `:546-562`); all `terminalResult` call sites (`:570-591`) collapse into one handler fed by `terminal` outputs; `MachineFailure` → `failed` with code+context.
6. **Clean cutover.** Delete dead branches (`resumeIncompleteFixer`, `blockingFindings` dispatch in `resolveReviewedPass`, `while`-condition exhaustion). **Preserve every pinned notify string:** the resume-into-triage path must still emit `Resuming incomplete fixer for pass N` (pinned by `loop.test.ts:424` `/incomplete fixer/`), and the clean-terminal path its `✅ Clean: …` line. LSP-verify no orphaned private helpers; public exports unchanged.
7. **Verify** (full battery below), including the fixer-on-final-pass pin (D6) and resume-equivalence pin (projection vs old `resumeIncompleteFixer` on the same artifacts).
8. **Docs touch.** One-line amendment where the evaluator seam is documented (ADR 0002 / extension description): code-review-iteration is now the second production consumer of `state-machine.ts`.

## Acceptance criteria

- [x] Every report §05 row has a named rule asserted by id in `machine.test.ts`; truth table green.
- [x] Exclusivity sweep green: every `ReviewFacts` combination routes to exactly one rule or to an allowlisted `NO_ROUTE`; the allowlist is a named constant in the test, not an inline skip.
- [x] `machine.ts` imports only `../state-machine.js`, `./findings.js`, `./rubric.js`, and type-only local imports — no `node:*`, git, or async host imports (purity per `state-machine.ts:1-7`).
- [x] `git diff extensions/code-review-iteration/__tests__/loop.test.ts` is **empty**; all 24 scenarios pass.
- [x] `RUN_STATE_SCHEMA` is still `1`; no migration/shim code exists anywhere.
- [x] Public API unchanged: `runReviewLoop`, `LoopCancelledError`, `LoopDeps`, `LoopOptions`, `LoopResult` signatures identical; `wire` call sites untouched.
- [x] Fixer-on-final-pass and exhaustion-at-`pass==max` behavior pinned by tests (D6 subtlety).
- [x] `MachineFailure` conversion path tested (inject malformed projection → `failed` with code in reason).
- [x] Notify-string parity: every `notifyLog` assertion in `loop.test.ts` (lines 239, 324, 355, 371, 388, 424, 437, 527, 589, 619) still matches.
- [x] `npm run guardrails:check` passes: `unit_test_gate`/`global_ratchet`/`complexity_gate` are `required`, `lint_gate` and `patch_gate` are `advisory`, `functional_test_gate` is `disabled` (`guardrails.json:3-9`). Global ratchet baseline is **79.4** (`guardrails.json:19`), not 79.5; `patch_coverage_min` is 90 but advisory — report a patch shortfall, do not treat it as blocking. `git add` the new `machine.ts`/`machine.test.ts` before the check: `diff-cover` excludes untracked files.

## Verification

- `npx vitest run extensions/code-review-iteration/__tests__/machine.test.ts` (truth table)
- `npx vitest run extensions/code-review-iteration/__tests__/machine.test.ts -t exclusivity` (full fact-domain sweep)
- `npx vitest run extensions/code-review-iteration/__tests__/` (all green, loop.test.ts unmodified)
- `npm run guardrails:check`
- LSP references: `runReviewLoop`, `LoopResult`, `LoopCancelledError` — callers unchanged (`extensions/code-review-iteration/index.ts`)
- Throwaway smoke: construct `project()` over a synthetic RunState + artifact pair and advance the machine through `initializing → … → clean`; delete after run.

## Execution Instructions

<!-- OMP opt-in: this plan is recommended to run under workflow mode. The plan
     title/scope contains "migrate", and verification fans out across four
     independent audit dimensions (truth-table completeness, integration
     no-diff audit, purity/API audit, guardrails) — an eval-cell fan-out with
     a judge fits that shape. Edit eval-review-loop-alignment.py before
     invoking. -->

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build-hard` against this plan (load-bearing live loop + strict no-behavior-change contract justify the hard variant).
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` cycle. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, resume from this plan; the truth-table skeleton (step 1) marks progress.

## Risks

- **Silent behavior change** — mitigated by the empty-diff acceptance criterion on `loop.test.ts` and the 14-row truth table; the fixer-on-final-pass subtlety (`loop.ts:715-724` vs `:648`) gets an explicit pin.
- **Framework creep** — the evaluator seam forbids async runtime/persistence/effects-in-machine (prior plan `:73-81`, `:104`); outputs stay opaque data interpreted only by `loop.ts`.
- **Guard/state drift** — state is derived from the same artifacts the supervisor writes; the machine table and `RunState` cannot disagree because the supervisor loses its independent early-return paths.
- **Projection cost** — `project()` reads at most the two JSON files `readJsonIfExists` already reads on resume (`loop.ts:680-684`); no new scanning layer.
- **Moving baseline** — HEAD was `fb8f469` at plan time with an untracked subject folder; re-read sources and re-run the baseline before step 1 if concurrent work lands.
- **Uncommitted dependency** — the plan's evaluator seam (`state-machine.ts`, `buck-loop/machine.ts` + tests, `docs/state-machine.md`) exists only in the working tree at plan time. Commit it before step 1 and measure the baseline green with it applied; otherwise the migration targets a contract that can vanish.
