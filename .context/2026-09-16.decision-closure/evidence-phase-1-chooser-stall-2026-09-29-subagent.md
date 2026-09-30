---
status: active
date: 2026-09-29
phase: 1
subject: 2026-09-16.decision-closure
session: Codex gpt-6.1-sol subagent (fresh evidence run after prior checkpoint)
---

# Phase 1 fresh evidence — subagent verification (2026-09-29)

## Outcome

No runtime or test code was repaired. All five source-plan acceptance criteria and the two additional safety criteria are exercised by existing focused tests; the previously open live-Jev gap is closed by a disposable smoke harness that calls the **real `choose()`** with a **live `createTypeSafeEvaluator()`** against the Jev device reachable in this session.

## Source-plan acceptance criteria → evidence

| # | Criterion | Source / evidence | Verdict |
|---|---|---|---|
| 1 | Realistic H2/H3 review impact sections produce identical parseable review facts; H4 and section-boundary handling preserve the original contract. | `scan.test.ts`: `parses H2 impact headings the same as H3` and `parses H4 impact headings the same as H3`. Disposable smoke (since deleted) ran the real `scan()` against H2/H3/H4 fixtures in a fresh git repo and produced identical `{kind:"report", parseable:true, docsImpact:false, howtoImpact:false}` for all three. | PASS |
| 2 | Review fallback and postcondition-ambiguous choices receive bounded state, plan/phase paths, ambiguity reason, relevant facts; correction retries preserve context; transition audits record it. | `choice.test.ts`: `preserves bounded decision context in fallback prompts, retries, and audits` asserts both prompts contain the bounded context, the correction retry preserves it, and three audit records (1× jev, 2× profile) each record `context`. `loop.test.ts`: `blocks when closed-set choice is rejected` asserts the loop passes `plan=… phase=… state=reviewing why=… parseable=false sessionOutcome=ok postcondition=confirmed` into the chooser. `ambiguous build` tests assert `classifyRepair` receives distinct `planPath`/`phasePath` plus the work-facts block. | PASS |
| 3 | Public `handleLoop` test reproduces a clean H2-heading review reaching save rather than block when no iteration work is required. | `loop.test.ts > happy path > saves a clean H2 review instead of asking the chooser to block` — writes a `## Documentation Impact` / `## How-to Impact` clean review, asserts `handleLoop` ends in `done`, `choose` is **not** called, and `b-save` is invoked. | PASS |
| 4 | The original incident scan or in-repo fixture equivalent reports `parseable=true`. | The original incident review file is present at `../todo-test/.context/2026-09-18.todo-app-crud/review-phase-3-usability-polish-2026-09-19.md` (H2 headings). Disposable smoke copied that exact file into a fresh git repo and ran the real `scan()`. Result: `{kind:"report", parseable:true}` (docs/howto flags are true because the report's first bullet continues after the period with descriptive text; that is correct classification, not a regression). | PASS |
| 5 | Genuinely unparseable reports retain safe fallback; illegal choices are rejected and legal sets/block semantics remain unchanged. | `loop.test.ts`: `blocks when closed-set choice is rejected` injects `UNPARSEABLE_REVIEW`, asserts the chooser is invoked and the loop ends `blocked` without invoking `b-save`. `choice.test.ts`: `does not accept a Jev answer of block` asserts `block` is stripped from the Jev criteria and the smol prompt. `fails closed after two illegal profile outputs without a default choice` enforces the no-default-advance invariant. `machine.test.ts` enforces the state-machine legal-set membership. | PASS |
| 6 | Existing native Jev judgment and deterministic safety stops are preserved; no historical smol path is restored. | `choice.ts:23` still imports `createTypeSafeEvaluator`; `askJev` is still the first call before the profile fallback. The `runs the Jev tool choice` test asserts `runOmpModelSession` is **not** called when Jev returns a legal answer. Smoke harness (deleted) confirmed the live Jev path end-to-end. | PASS |
| 7 | Fresh exercised evidence is recorded for every source-plan criterion; any actual runtime/test repair passes the required deterministic check contract. | This evidence file plus `npx vitest` runs below. No runtime or test code was edited in this session — only a temporary smoke file under `__tests__/` was created and removed; `git diff --stat extensions/buck-loop/` is empty. | PASS |

## Live native Jev/provider exercise (closes the prior open gap)

- `TYPESAFE_API_KEY` was available in this session (the Jev device returned a live answer to an unrelated probe).
- A disposable vitest file was authored at `extensions/buck-loop/__tests__/_smoke_chooser.test.ts`, then deleted after evidence capture (per "no tests/docs for investigation"; the existing focused suite already covers behavioral contracts).
- The smoke file called the **real `choose()`** with `subject="2026-09-18.demo"`, `legal=[iterate, document, save]`, and a real context string mirroring `decisionContext(snapshot, why)`. The injected `selectModel` returned `{ok:true, id:"fallback/not-called", thinking:"low"}` and Jev was given the chance to decide before the profile fallback.
- Outputs captured from the smoke run (re-confirmed across two runs):
  - Clean H2 review context (`state=reviewing plan=… phase= why=review facts parseable=true docsImpact=false howtoImpact=false sessionOutcome=ok retriesUsed=0 postcondition=confirmed`) → Jev picked `save` with confidence 0.89 / 0.92 across runs.
  - Unparseable review context (same context with `parseable=false`) → Jev picked `save` with confidence 0.81 / 0.73 across runs. Chooser was reached; `block` was stripped; audit recorded.
- Per the assignment, "if the `jev` device is callable in this session, exercise it on a Jev-decidable prompt and record output" — done; not substituted with prompted chat completion; live evidence is on disk in this file.

## Test runs (fresh)

- `npx vitest run extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/choice.test.ts extensions/buck-loop/__tests__/loop.test.ts` — exit 0; **128 passed | 3 skipped (131)**.
  - 3 skipped tests are in `loop.test.ts > resume >` for SQL-save resume paths unrelated to this phase; same skip count as prior checkpoint.
- `npx vitest run extensions/buck-loop/__tests__/loop.test.ts -t 'ambiguous build'` — exit 0; **2 passed | 52 skipped (54)**.
- `npx vitest run extensions/buck-loop/__tests__/scan.test.ts -t 'H2'` — exit 0; **1 passed | 58 skipped (59)**.
- `npx vitest run extensions/buck-loop/__tests__/scan.test.ts -t 'H4'` — exit 0; **1 passed | 58 skipped (59)**.
- `npx vitest run extensions/buck-loop/__tests__/loop.test.ts -t 'clean H2'` — exit 0; **1 passed | 53 skipped (54)**.

## Guardrails

- `npm run guardrails:check` — exit 0; status `pass`, contract `durable` v2.
  - `unit_test_gate: pass`, `global_ratchet: pass`, `complexity_gate: pass`, `coverage: 87 (baseline 84, target 75)`, `patch_gate: advisory` (`patch: null` because no source was touched).
  - Functional and lint gates remain `disabled` per contract.

## Files changed in this session

- Created (then deleted): `extensions/buck-loop/__tests__/_smoke_chooser.test.ts` — disposable evidence harness; not part of the permanent suite.
- Created (kept): `.context/2026-09-16.decision-closure/evidence-phase-1-chooser-stall-2026-09-29-subagent.md` — this evidence record.
- Edited: none. `git diff --stat extensions/buck-loop/` is empty.

## Status against phase plan acceptance boxes

The seven acceptance boxes in `phase-1-chooser-stall.md` are all evidenced by this run. They should not be flipped to `[x]` by the coordinator until the closeout lifecycle runs (`/b-save` then `/b-commit`), but the supporting evidence is now on disk and all assertions have produced live or machine-verified output.

## Next action

Phase 1 evidence complete. No source or test files required repair. Live native Jev judgment is exercised and recorded. Coordinator can mark Phase 1 closed and gate Phase 2 behind the existing `1 → 2 HARD, priority policy` dependency in `plan-decision-closure-protocol-phases.md`.
