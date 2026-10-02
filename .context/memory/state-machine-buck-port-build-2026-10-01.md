---
date: 2026-10-01
domains: [architecture, extensions, testing]
topics: [state-machine, buck-loop, phase-2, routing, portability, review]
priority: high
status: active
subject: 2026-10-01.state-machine-redesign
artifacts: [phase-2-port-buck-machine.md, plan-state-machine-module-cutover-phases.md, build-phase-2.md, guardrails-phase-2.json, draft-commit.md]
---

# Buck machine portable-module cutover

## Decisions

- Implement Phase 2 only; follow hard-build guidance for the supervisor routing port.
- Reuse `extensions/state_machine/index.ts`; preserve state names, Choice kinds, reasons, and all production adapter exports in scope.
- Guards receive `Snapshot & { sqlMemoryConfigured: boolean }`; only the adapter reads the environment.
- Preserve ambiguous SQL saves as a single-option `choose` effect, an explicit narrow exception to the original one-target policy. User requested continuation after the recommended preservation exception was presented; existing expectations remain unchanged.
- Keep overlapping exhausted-retry/loop-limit facts fail-closed. Preserve `legalChoices` as an empty result when a decision is closed. Restrict USER_CONFIRMED to blocked, even if another normal edge shares its target.
- SQL memory tooling is unavailable in this Codex session; use file memory as required outside a configured OMP loop. Existing Phase 1 SQL receipts remain untouched.
- W1 untyped module hardening remains a separate follow-up; it is outside Phase 2's declared files.

## Files Modified

- `extensions/buck-loop/machine.ts`
- `extensions/buck-loop/__tests__/machine.test.ts`
- `.context/2026-10-01.state-machine-redesign/phase-2-port-buck-machine.md`
- `.context/2026-10-01.state-machine-redesign/plan-state-machine-module-cutover-phases.md`
- `.context/2026-10-01.state-machine-redesign/plan-state-machine-module-cutover.md`
- `.context/2026-10-01.state-machine-redesign/build-phase-2.md`
- `.context/2026-10-01.state-machine-redesign/guardrails-phase-2.json`
- `.context/2026-10-01.state-machine-redesign/draft-commit.md`
- `.context/memory/state-machine-buck-port-build-2026-10-01.md`
- `.context/memory/index.md`
- `.context/workflow/current-session.json`

## Verification

100 reachable legacy-rule fixtures pin literal complete outputs; 12 generated legacy rules had impossible constant skill guards. Machine suite: 204 passing. All Buck suites: 438 passing, 4 skipped, 12 files. Supervisor/types/choice and loop/persist test diffs are empty. Two snapshot sweeps compare 1,148,928 adapter calls in SQL/file modes with zero output/rejection mismatches. Strict focused TypeScript passes; whole-project before/after output is identical (194 existing diagnostics in 30 files). Final parent clean-project criterion remains unchecked; no later-phase waiver assumed.

Required guardrails pass (durable v2): 87.5% coverage vs 84% baseline; no new complexity violations. Proposed baseline raise not applied. Verdict preserved under the subject. All verification used fresh processes outside buck-loop.

`/b-review` against `phase-2-port-buck-machine.md`: pass with warnings. Spec axis: all seven acceptance criteria satisfied (exports unchanged; truth-table pins; manual-edge-to-aborted test; `next` policy with single-option SQL exception; empty unchanged-file diffs; unmodified loop/persist suites pass; wording derived from facts via shared helpers). Standards axis (initially misreported, corrected after advisor challenge): `LEGACY_ROWS` uses recursive `as const`, so nested `choice`/`event` literals are preserved — proven by the passing focused strict `tsc` (`applyChoice(row.choice, s)` requires literal kinds). Residual nit: `row.overrides as Partial<Snapshot>` and `toEqual(row.expected)` leave row shapes unchecked against `Snapshot`/`Transition`; minor duplicate reason-helper evaluations; env save/restore duplicated in two test blocks. None are in-plan defects.

## Next steps

Phase 2 review passed. Run `/b-commit` with the draft commit; then Phase 3 (reviewMachine port). No commit or push performed.
