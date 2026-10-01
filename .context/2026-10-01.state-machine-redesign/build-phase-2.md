---
status: completed
date: 2026-10-01
subject: 2026-10-01.state-machine-redesign
phase: phase-2-port-buck-machine.md
---

# Phase 2 build evidence

## Scope and decisions

Port only `extensions/buck-loop/machine.ts` and its machine test to `extensions/state_machine/index.ts`. Keep the production adapter exports, persisted state/choice vocabulary, supervisor, and persistence implementation unchanged. The machine declares one edge per target, manual START/USER_CONFIRMED/STOP, initial `idle`, and final `done`/`aborted` with no outgoing edges. SQL configuration is captured as an adapter fact; guards do not read the environment.

Follow the settled plan's local module and reason-helper patterns. No dependency or additional runtime abstraction is introduced. Effects remain data; `loop.ts` remains the only effect interpreter. Merged edges derive guards and output reasons from the same helper. `BuckMachineError` handles missing routes, unexpected overlaps, and illegal choices; module errors handle invalid names and manual transitions.

Preserve the existing SQL-save single-option decision: when an ambiguous SQL save permits only retry, `next()` returns the original `choose` effect and reason. This is a narrow exception to the original one-target policy. The user requested continuation after the recommended preservation exception was presented. Automatic retry would change the existing decision boundary and violate the unchanged-behavior goal. The pre-existing test expectation remains untouched.

The old postcondition retry-exhausted and loop-limit rules overlap when both ceilings are hit. Keep that input fail-closed rather than silently choosing a merged reason. `legalChoices()` returns no choices when the decision is closed, preserving its prior query behavior without catching unrelated exceptions. USER_CONFIRMED is accepted only from `blocked`, even when another state's normal transition happens to have the same destination.

## Test seams

Tests cross the production exports `next`, `applyChoice`, `legalChoices`, `start`, `userConfirmed`, and `stopFrom`; fixtures supply caller-owned snapshots with literal expected destinations/effects/reasons. Graph inspection uses the module's public definition/instance interfaces. No filesystem or model is needed for policy tests. A single adverse-overlap test substitutes the module's returned availability list to verify the adapter fails closed; it does not mock routing outputs. The unchanged loop and persistence suites exercise their real integration paths.

## Verification

- Baseline machine suite: 74 passing tests before the port.
- RED: 10 operator-graph assertions fail against the old evaluator because its interface exposes no `edge`/`restore`/`available` methods. GREEN: the port passes those assertions and the existing expectations.
- Additional RED/GREEN: conflicting exhausted retries exposed a `legalChoices` behavior difference; a USER_CONFIRMED fixture outside `blocked` exposed an unintended valid normal edge. Both regressions were fixed and pinned.
- Literal truth table: 100 reachable legacy rules captured before replacement, including automatic, accepted-choice, and operator outputs. The 12 remaining generated legacy rules are unreachable: their constant skill equality/inequality guard contradicts the state skill. Extra literal assertions cover limit-priority wording where one former rule could produce multiple reasons.
- Final machine suite: 204 passing tests.
- `npx vitest run extensions/buck-loop`: 12 suites, 438 passing tests, 4 skipped.
- Read-only differential comparison: 574,464 adapter calls each in configured SQL mode and file mode, 1,148,928 total; zero mismatches. Cross product covers states, pending/failed/ok sessions, pending/missing/confirmed/ambiguous postconditions, retry and global/iterate ceilings, all plan kinds, all review flag combinations, `next`, `legalChoices`, and all six choice kinds. Full successful outputs compare exactly; expected errors compare rejection behavior, since error types intentionally change. Local comparison logs: `/tmp/buck-comparison.txt`, `/tmp/buck-comparison-file.txt`.
- Empty diffs for `extensions/buck-loop/types.ts`, `loop.ts`, `choice.ts`, `__tests__/loop.test.ts`, and `__tests__/persist.test.ts`.
- Strict focused TypeScript check passes: `npx tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node extensions/buck-loop/machine.ts extensions/buck-loop/__tests__/machine.test.ts`.
- Whole-project `npx tsc --noEmit -p .` exits 2 before and after: identical 194 diagnostics across 30 existing files, no diagnostics in the changed files. Logs `/tmp/buck-phase2-tsc-before.txt` and `/tmp/buck-phase2-tsc-after.txt` compare byte-identically. No later-phase exception is assumed; the parent's final clean-project criterion remains unchecked.
- `npm run guardrails:check`: exit 0, durable v2, required gates pass, coverage 87.5% against baseline 84%, no new or hard-ceiling complexity violations. Lint and functional gates remain disabled under the existing contract. Proposed baseline increase was not applied. Durable verdict: [guardrails-phase-2.json](guardrails-phase-2.json).
- Verification ran in fresh processes, outside `/buck-loop`; no `/reload` was used.
- `git diff --check` passes.

## Decision closure

Selected course: reuse the finalized module and preserve consumer behavior, including the SQL choice boundary. A-1 (persisted vocabulary/API integration) and A-3 (wording derived from facts) are validated by unchanged-file diffs, unchanged integration tests, literal rule fixtures, and both-mode differential comparisons. No blocking assumption remains for this phase.

Material risk: routing drift can run the wrong skill or record a different history reason. Mitigation is the literal truth table plus unchanged loop/resume/persist suites. Rollback is the isolated Phase 2 commit once created; before that checkpoint, the baseline consumer and test remain recoverable from HEAD `c68e51b`. Validation confirms no other runtime file changed and the baseline machine suite passed before editing. The existing project TypeScript errors remain a recorded limitation, without weakening guardrails.

Excluded scope: review-machine port, old-engine deletion, site/living-doc migration, and the previously recorded W1 untyped-module hardening follow-up. Phase 2's declared files do not include module hardening; leave it for a separate bounded task.

## Next

Run `/b-review` against `phase-2-port-buck-machine.md`, then `/b-save`, then `/b-commit` with the draft commit. Phase 3 follows after this checkpoint. No commit or push was performed by this build.
