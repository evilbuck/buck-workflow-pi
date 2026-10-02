---
date: 2026-10-01
domains: [architecture, extensions, testing]
topics: [state-machine, module-finalization, phase-1, tdd, portability]
related: [reusable-state-machine-phase-1-build-2026-09-20.md]
priority: high
status: in-progress
subject: 2026-10-01.state-machine-redesign
artifacts: [phase-1-module-finalization.md, plan-state-machine-module-cutover-phases.md, build-phase-1.md, iterate-module-finalization.md, draft-commit.md, review-phase-1-module-finalization.md, sql-memory-receipts/phase-1-save-rows.json]
sql_memory_ids:
  - "01a0f787-76f9-7066-b52d-b5881d723178"
---

# State machine module finalization

## Decisions

- Execute Phase 1 only from the four-phase cutover plan.
- Preserve all prototype runtime behavior; extract both demonstrations from `index.ts` into `examples/transmission.ts` so importing the library is silent.
- Keep runtime files dependency-free and allow the required Vitest test-only import. Avoid changing the global test configuration to hide that development dependency.
- Tests use public definition/instance interfaces and literal expected values, with no mocked implementation internals.
- Existing whole-project TypeScript failures are outside this phase: independent master comparison confirms the same 194 diagnostics across 30 files, none in the module. On 2026-10-01, after reviewing this evidence, the user approved a Phase 1-only acceptance exception ("ok. I approve."). Phase criterion records the exception; project errors remain unresolved, with no later-phase waiver or guardrails changes.
- Review follow-up S1 captures initial and final-state metadata and uses normalized graph keys for restore membership. Caller mutation must not alter the validated definition; caller inputs remain mutable.
- Two review passes: pass 1 (needs work, S1), pass 2 (pass with warnings). S1 verified by mutation scenarios; the TypeScript criterion is independently re-checked in this session against `/tmp/jev-tsc-master.txt` vs `/tmp/jev-tsc-current.txt` (byte-identical after root normalization).
- SQL memory tooling is available in this OMP session. One closeout row inserted for Phase 1 with verified receipt `01a0f787-76f9-7066-b52d-b5881d723178`; receipt at `.context/2026-10-01.state-machine-redesign/sql-memory-receipts/phase-1-save-rows.json`. No `.context/memory/` body file is created for this run; the durable source for this closeout is the verified SQL receipt.

## Files Modified

- `extensions/state_machine/index.ts`
- `extensions/state_machine/state_machine.test.ts`
- `extensions/state_machine/README.md`
- `extensions/state_machine/examples/transmission.ts`
- `.context/2026-10-01.state-machine-redesign/phase-1-module-finalization.md`
- `.context/2026-10-01.state-machine-redesign/plan-state-machine-module-cutover-phases.md`
- `.context/2026-10-01.state-machine-redesign/plan-state-machine-module-cutover.md`
- `.context/2026-10-01.state-machine-redesign/build-phase-1.md`
- `.context/2026-10-01.state-machine-redesign/draft-commit.md`
- `.context/2026-10-01.state-machine-redesign/iterate-module-finalization.md`
- `.context/2026-10-01.state-machine-redesign/review-phase-1-module-finalization.md`
- `.context/2026-10-01.state-machine-redesign/sql-memory-receipts/phase-1-save-rows.json`
- `.context/memory/state-machine-module-build-2026-10-01.md`
- `.context/workflow/current-session.json`

## Verification

Build: import-purity RED caught five log calls; example extraction made it GREEN. Original 20 behavior tests passed. Strict library/tests/example and separate library-only ES2022/no-ambient compilation passed. Whole-project TypeScript before/after had the same 194 diagnostics. Build guardrails passed at 87.2% coverage against the 84% baseline, with no new complexity violations.

Iteration: all four new mutation regressions failed before the snapshot fix; all 24 module tests pass afterward. Strict focused library/tests/example TypeScript check passes. `/usr/bin/bun` example prints all five documented lines, exit 0. The initial iteration did not rerun the known whole-project failure; the subsequent master comparison and user-approved exception are recorded below.

Second review pass (this session): guardrails re-run, exit 0, durable v2, diagnostics empty; unit, coverage ratchet (87.2% vs 84%), complexity green; lint and functional disabled. Mutation scenarios verified end-to-end:

```text
initial: ready ready            # before: ready done
ghost: UnknownStateError true    # caller-only state rejected immediately
removed-state: ready [ "done" ] false
finality: true false true false
```

`/tmp/jev-tsc-master.txt` and `/tmp/jev-tsc-current.txt` re-checked: byte-identical after root normalization (194 across 30 files, zero in module).

## Independent master baseline verification

User challenged whether the recorded TypeScript errors exist on master. Created a detached worktree of local master `e3ffb37abd1734ea2ceffac3fa0ea0e204dc1540` at `/tmp/jev-state-machine-master-typecheck` (same locally recorded `origin/master`; no remote fetch). Shared the existing installed `node_modules` to keep compiler/dependencies constant; tracked master source stayed clean. Fresh `tsc --noEmit -p .` runs in master and current checkout both exit 2 with 194 diagnostics across 30 files. Full output is identical after checkout-root path normalization; zero module diagnostics. Logs: `/tmp/jev-tsc-master.txt`, `/tmp/jev-tsc-current.txt`. The earlier claim is now independently confirmed against master. After this comparison, the user approved the Phase 1-only acceptance exception ("ok. I approve.").

## Open Phase 2 hardening (W1)

Three pre-existing sites dereference `edges.get` with bang: `assertValid` BFS at `index.ts:165–171`, `targets(state)` at `index.ts:119`, `edge(from, to)` at `index.ts:122`. Reachable only from untyped callers; typed signatures reject unknown `initial`/`Name`. Verified at runtime: `defineMachine()({ initial: "missing" as any, states: {...} })` raises `TypeError: undefined is not an object (evaluating "edges.get(state).keys")`. Plan (Phase 2 or standalone follow-up):

- `assertValid`: prepend `"unknown initial: <name>"` to `problems` and `return` before the BFS; surface through the existing `InvalidMachineError`.
- `targets`/`edge`: route through the captured `has(state)` check throwing `UnknownStateError`; replace the three `!` sites.
- Mirror the existing untyped undeclared-target test at `state_machine.test.ts:92` with an unknown-initial case.

Non-blocking for Phase 1 acceptance; not a defect introduced by this iteration.

## Next steps

Run `/b-save` (this artifact), then `/b-commit` using the recorded draft commit. Phase 1 stays `in-progress` until durable save and `/b-commit`; consumer cutovers belong to Phases 2–4.