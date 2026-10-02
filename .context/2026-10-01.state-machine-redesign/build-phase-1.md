---
status: in-progress
date: 2026-10-01
subject: 2026-10-01.state-machine-redesign
phase: phase-1-module-finalization.md
---

# Phase 1 build evidence

## Scope and decisions

Implement Phase 1 only. Keep the prototype's graph and instance behavior unchanged; remove its import-time demonstrations and move both demonstrations to `examples/transmission.ts`. The existing production consumers still use the old engine until their own phases.

The zero-import requirement applies to runtime source: `index.ts` has no imports and the example imports only `../index.js`. The required Vitest suite imports its test runner as a development dependency. This reconciles the plan's literal folder-wide import wording with its requirement for a Vitest test inside that folder, without adding runtime dependencies or changing global test configuration.

Tests enter through `defineMachine`, the definition's `start`/`restore`/graph queries, and the instance's `available`/`transition`/state queries. No internal implementation is mocked; only user-supplied guard/effect callbacks and console output are observed. Expected states, targets, and effect descriptions are literal fixtures.

## Verification

- RED: the import-purity test failed with five `console.log` calls from the embedded examples.
- GREEN: extracting both examples made the import-purity test pass. The rest of the required behaviors already existed in the prototype and pass their preservation tests.
- Final `npx vitest run extensions/state_machine`: 20 tests passed. The undeclared-target fixture also has a valid reachable final target, so another graph error cannot mask that regression.
- Strict TypeScript check of the library, test file, and example passed with `--ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types node`.
- A separate TypeScript program checked `index.ts` with only the ES2022 library and `types: []`: passed. The module needs no platform ambient types.
- `bun extensions/state_machine/examples/transmission.ts`: exit 0; all five stdout lines match the README. `/usr/bin/bun` also ran cleanly; the shell's Bun shim emits an unrelated cache warning on stderr.
- Source scan: no platform API references; the only production import is the example's in-folder `../index.js`.
- Repository-wide `npx tsc --noEmit -p .`: exit 2 before and after, with the same 194 diagnostics across 30 existing files and no diagnostics under `extensions/state_machine/`. Full local logs: `/tmp/state-machine-tsc-baseline.txt`, `/tmp/state-machine-tsc-after.txt`.
- `npm run guardrails:check`: exit 0, durable v2 verdict `pass`; required unit, global coverage ratchet, and complexity gates pass. Coverage 87.2% against baseline 84%; no new or hard-ceiling complexity violations. Functional and lint gates are disabled by the existing contract. Patch gate passes with no patch percentage. The runner's proposed coverage ratchet increase was not applied.
- Sandbox verification attempts were interrupted after failing test subprocess launches (`spawnSync git EPERM`). The final guardrails check ran outside the sandbox with approval and passed; the permission error was not treated as a source defect.
- `git diff --check` passes. The old engine and both production consumers have no diff; existing package/site changes from before this build are preserved.

## Remaining acceptance blocker

- Keep the phase `in-progress` and its combined clean-project-type-check criterion unchecked: fixing 194 unrelated diagnostics would exceed this phase's approved scope. Record the baseline for review rather than weakening the criterion.

## Next

Run `/b-review` against `phase-1-module-finalization.md`, including disposition of the existing whole-project TypeScript blocker. Run `/b-save` to finalize and `/b-commit` after acceptance is settled. Phase 2 remains pending.
