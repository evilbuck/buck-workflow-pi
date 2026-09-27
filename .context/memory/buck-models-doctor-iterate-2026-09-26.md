---
date: 2026-09-26
domains: [extensions, diagnostics]
topics: [buck-models, doctor, review-iteration, complexity-gate]
related: [buck-models-doctor-plan-2026-09-25.md]
priority: medium
status: completed
subject: 2026-09-25.buck-models-doctor
artifacts: [iterate-buck-models-doctor.md, draft-commit.md]
---

# buck-models doctor iteration — 2026-09-26

Resolved all five critical issues in `iterate-buck-models-doctor.md`.

## Decisions

- **Cross-scope inventory without collapsing**: `buildDoctorReport` no longer dedupes profile names across scopes; each saved scope/profile is its own row. Project rows list inherited global stages flagged `ownedBy: user-global`; global rows show only their own stages. `countConfigured` counts only stages saved by the row's scope, so inherited stages are displayed but counted once under their saving scope (matches review's 3-occurrence fixture).
- **Active marker**: header marks the row matching `active.name` in the scope that sourced it; if no row exists in the source scope, falls back to any same-name row so the effective active profile is always visible.
- **Active-name parity**: `resolveCandidate` now validates candidate names against both scopes for project *and* global sources, matching runtime `nameKnown` in `extensions/omp-models.ts` (`resolveActiveName`).
- **Severity**: active health evaluated before the empty-inventory case. `unknown` → warning; `blank` with configured profiles → warning; genuinely empty config stays info.
- **Fail closed**: `readDoctorLoad` wraps each `load()` in try/catch and marks IO failure as `invalidPath`; `availableIds` catches a throwing `getAvailable()` → `null` → error report; `dispatchArgs` is async and awaits `runDoctor`, which catches everything into an error notification. No floating promise, no unhandled rejection after handler resolves.
- **Complexity gate**: `handleInput` in `extensions/buck-models/model-picker.ts` (complexity 16) decomposed into `applyCursorMove`, `toggleAtCursor`, `applyQueryEdit`; guardrails `complexity_gate: pass`.

## Verification

- `npx vitest run` full suite: 68 files, 1040 tests pass (includes 6 new tests: 3 doctor pure, 2 command-level error paths, 1 same-name overlap).
- `npm run guardrails:check`: `status: pass`, `contract: durable`, all required gates pass.

## Remaining

- Warning issue 1 (live OMP TUI smoke of `--doctor` with fixture + checksums) still not exercised in this session — needs a real OMP run before final sign-off.

## Files Modified

- extensions/buck-models/doctor.ts
- extensions/buck-models/doctor.test.ts
- extensions/buck-models/index.ts
- extensions/buck-models/index.test.ts
- extensions/buck-models/model-picker.ts
- .context/2026-09-25.buck-models-doctor/{iterate-buck-models-doctor.md,draft-commit.md}
