---
status: completed
date: 2026-10-01
updated: 2026-10-01
subject: 2026-10-01.state-machine-redesign
topics: [review, iteration, state-machine]
informs: []
addresses: phase-1-module-finalization.md
completed: 2026-10-01
from_review: b-review
---

# Iteration: Module Finalization

## Source

- Reviewed after: `/b-build`.
- Phase: [phase-1-module-finalization.md](phase-1-module-finalization.md).
- Parent plan: [plan-state-machine-module-cutover.md](plan-state-machine-module-cutover.md), steps 1–4 only.
- Evidence and both review axes: [review-phase-1-module-finalization.md](review-phase-1-module-finalization.md).

## Critical Issues

### 1. P2: definition methods mix captured graph data with live caller configuration

- **File**: `extensions/state_machine/index.ts:107–125`.
- **Problem**: edges are normalized once, but `start()` rereads caller initial, `restore()` checks live caller state membership, and `isFinal()` reads live caller metadata. Caller mutation changes the definition without revalidation; fixing only `start()` is insufficient.
- **Evidence**: the original typed initial-mutation fixture compiles with zero diagnostics and prints `before ready ready`, then `after ready done`. The advisor/user reported that adding caller-only `ghost` makes `restore("ghost")` succeed and later `available()` throw. Source confirms live membership at line 110 versus captured edges at line 114; this reported failure was not rerun merely to confirm it. A fresh finality smoke prints `before true true`, then `after false false` after caller final-metadata mutation, affecting both definition and restored-instance finality.
- **Proposed fix**: snapshot initial and final-state metadata at definition creation; validate restored names against captured graph keys. All methods must use the same validated snapshot. Do not freeze or mutate caller input, redesign the public API, or add compatibility paths.
- **Regressions**: mutate a typed caller initial and preserve original start state; add caller-only ghost and require immediate `UnknownStateError` from restore; remove a caller state and retain restoration/routing from the captured graph; mutate an optional typed `final?: true` field and preserve definition plus existing/new instance finality. Verify consumer-visible invariants, not source text.
- **Verify**: focused module tests, strict focused TypeScript check, runnable example output, and deterministic guardrails. Re-review Phase 1.

## Warnings

### 1. Existing whole-project TypeScript acceptance blocker — disposition approved

- **File**: `phase-1-module-finalization.md:21,65`; `build-phase-1.md:27,32–34`.
- **Problem**: the explicit clean-project `npx tsc --noEmit -p .` criterion remains unmet. Build evidence records 194 identical pre-existing diagnostics across 30 files, none in the module. Focused compile and required guardrails pass; neither is a waiver of this criterion.
- **Suggested approach**: obtain explicit user approval to disposition the baseline failure for this phase, or repair it under a separately approved scope. Do not silently weaken the criterion, expand this iteration into unrelated TypeScript repair, or rerun the known failing command merely to confirm the report. Preserve the phase's unfinished state until disposition and re-review.

## Recommended Workflow

Run `/b-iterate` on this artifact for the in-plan S1 fix and regression. Resolve the acceptance blocker explicitly, then re-run `/b-review` against Phase 1. Complete this artifact only after the fix, passing review and durable `/b-save`; commit after acceptance. Consumer cutovers remain out of scope.

## Iteration evidence (2026-10-01)

- S1 implemented: `initial` and final-state names are captured when the definition is created; restore membership uses the normalized graph keys. Definition methods no longer read live caller configuration. Caller input remains mutable.
- Four new public-interface regressions cover typed initial mutation, immediate rejection of an added `ghost`, restoration and routing after removing a caller state, and finality preservation for the definition and existing/new instances after optional `final?: true` metadata changes. All four failed before the fix; all 24 module tests pass afterward.
- Strict focused TypeScript check of library/tests/example passes with `--ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types node`.
- `/usr/bin/bun extensions/state_machine/examples/transmission.ts` exits 0 and prints all five documented lines.
- `npm run guardrails:check`: exit 0, durable v2 verdict `pass`, diagnostics empty. Required unit, coverage ratchet (87.2% against baseline 84%), and complexity gates pass; no new or hard-ceiling complexity violations. Functional/lint gates are disabled; advisory patch gate passes with percentage null. Proposed coverage baseline increase was not applied. Ran outside the sandbox under the existing approval because the build recorded sandbox subprocess permission failures.
- `git diff --check` passes. Session memory and draft commit updated; no consumer cutover or unrelated implementation changes.
- The previously recorded 194 whole-project TypeScript diagnostics were not rerun. No acceptance override or unrelated repair has been authorized. Phase 1 stays `in-progress`; this artifact stays `active` until acceptance disposition, re-review and durable save, as required above.

## Master baseline verification (2026-10-01)

At the user's request, independently checked a detached worktree of local `master` (`e3ffb37abd1734ea2ceffac3fa0ea0e204dc1540`, also the locally recorded `origin/master`) at `/tmp/jev-state-machine-master-typecheck`. No remote fetch was performed. Linked the existing checkout's `node_modules` into the disposable worktree to hold installed compiler/dependency versions constant; tracked master source remained unchanged. Master and current checkout have identical TypeScript configuration, dependency declarations and lockfiles (the only package difference is an unrelated `site:serve` script).

Ran `./node_modules/.bin/tsc --noEmit -p .` in both checkouts. Both exit 2 with 194 diagnostics across 30 files. Their **entire diagnostic output is identical after replacing each checkout's absolute root path with the same placeholder**. Current output contains zero diagnostics under `extensions/state_machine/`. This confirms the errors exist on master, beyond the original build's before/after evidence.

Logs: `/tmp/jev-tsc-master.txt` and `/tmp/jev-tsc-current.txt`. This verification alone did not authorize an acceptance exception.

## Approved disposition (2026-10-01)

After the master comparison, the user explicitly approved the Phase 1-only TypeScript acceptance exception: "ok. I approve." Updated the phase acceptance criterion to record the exception, identical master diagnostics and passing focused compilation/tests. The project errors remain unresolved; no unrelated repair or later-phase exception is authorized.

S1 is implemented and verified, and the TypeScript acceptance blocker is dispositioned. Post-iteration review is completed with `pass-with-warnings`; the verified durable save receipt is [phase-1-save-rows.json](sql-memory-receipts/phase-1-save-rows.json), row `01a0f787-76f9-7066-b52d-b5881d723178`, `probed: true`. This iteration and Phase 1 are completed. The phase commit checkpoint remains pending in this checkout.
