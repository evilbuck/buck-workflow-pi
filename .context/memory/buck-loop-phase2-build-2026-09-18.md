---
date: 2026-09-18
domains: [extensions, testing, state-machine]
topics: [buck-loop, artifact-scan, projection, resume, phase-2, iteration]
related: [buck-loop-phase1-build-2026-09-18.md, buck-loop-phase2-review-2026-09-18.md]
priority: high
status: completed
subject: 2026-09-18.buck-loop-extension
artifacts:
  - phase-2-artifact-state.md
  - plan-buck-loop-extension.md
  - plan-buck-loop-extension-phases.md
  - iterate-buck-loop-artifact-state.md
  - iterate-buck-loop-artifact-state-2.md
  - draft-commit.md
---

# buck-loop Phase 2: Artifact State (build)

Built `extensions/buck-loop/scan.ts` and `persist.ts` per
`.context/2026-09-18.buck-loop-extension/phase-2-artifact-state.md`.

## What exists now

- `scan.ts` — explicit path only (plan, phase, or subject). First incomplete
  phase whose HARD `depends_on` are completed. Never creates a plan. Never
  guesses among subjects or among multiple plans in one subject.
- `persist.ts` — versioned `.context/workflow/buck-loop.json`. `resume()`
  rescans disk, then reconciles. No `orchestration.snapshot.json`.
- Tests: 34 scan + 15 persist = 49 focused regressions, including malformed
  metadata, active/completed iteration state, failed Git observation, and projection corruption.

## Iterate passes (b-review fixes, same day)

- **No dependency-blocked fallback.** `pickPhase()` no longer returns
  `incomplete[0]` when nothing is dependency-ready. Cycle or a `depends_on`
  naming a nonexistent phase → `{kind: "blocked", reason}` → `planFacts:
  missing` with that reason, `phasePath: null`, subject/plan still resolved.
  The table's `missing` → `blocked` branch does the rest; the frozen
  Phase 1 `PlanFacts` union is untouched (types.ts doc comment updated).
- **Strict `parseDependsOn`.** A dependency value must be a complete bracketed
  list. Unmatched brackets (`[1`, `1]`), non-integers, negatives, and empty
  entries (incl. `[two]`, `[1.5]`, `[1,]`) are malformed, not silently
  dropped. Malformed `depends_on` on any incomplete phase blocks selection
  with file + raw value in the reason.
- **Shared test fixtures.** `extensions/buck-loop/__tests__/fixtures.ts`
  owns isolated temporary Git repositories and artifact builders for both
  scan and persistence regressions, eliminating duplicate setup.
- **Strict counters on resume.** `asInt` now requires non-negative integers;
  new `asMaxLoops` requires a positive integer. Violations make
  `normalizeProjection` return null → `blocked`/`unreadable` (existing path).
- Note: `Resolved.planFacts` widened to full `PlanFacts`; TS 5.5 does not
  infer predicates for `p.dependsOn.kind ===` — used an explicit `p is`
  predicate in `pickPhase`'s `find`.

### Round 2

- Completed `iterate-*.md` files no longer count as active; status-less files remain active fail-safe.
- Failed `git status` observation is distinct from a clean tree and cannot confirm a commit.
- Projection enum validation now uses own-property checks, rejecting inherited keys such as `toString`.

## Resume rules (frozen for Phase 5)

- Stale projection `building` + `phased-complete` on disk → snapshot `done`.
- Projection `done` + `phased-incomplete` → `blocked` with
  `planFacts.kind: missing` reason containing done/incomplete; `phasePath`
  still names the incomplete phase.
- Vanished `.context/<subject>` → `blocked`, reason `vanished`.
- Unreadable projection JSON → `blocked`, reason `unreadable`.
- No projection and no path → `idle` + missing.
- Counters/history come from the projection; identity and facts come from
  the rescan. `iterateCyclesOnPhase` resets when `phasePath` changes.

## Scan contracts used by the table

- Unparseable review (missing both impact headings) → `parseable: false`
  and both impact flags false. Iterate file still wins if present.
- Building session `ok` + dirty tree + phase still pending →
  `postcondition: ambiguous`. Phased-complete → `confirmed`.
- Reviewing session `ok` → postcondition `confirmed` (table ignores it).
- Committing session `ok` + clean tree → `confirmed`.
- Iterating session `ok` + no active `iterate-*.md` → `confirmed`.

## Verification

- Focused iteration regression: `npx vitest run
  extensions/buck-loop/__tests__/scan.test.ts
  extensions/buck-loop/__tests__/persist.test.ts` → 49/49 passed.
- Iterate light unit gate: `npx vitest run` → 53 files, 852 tests passed.
  `guardrails.json` disables lint, so no lint command applies.
- Re-review 2026-09-18: `/b-review` Pass with warnings; guardrails durable v2 pass.

## Next

`/b-commit`. Phases 3 and 4 remain independently runnable after commit.

## Files Modified

- `extensions/buck-loop/scan.ts`
- `extensions/buck-loop/persist.ts`
- `extensions/buck-loop/__tests__/fixtures.ts`
- `extensions/buck-loop/__tests__/scan.test.ts`
- `extensions/buck-loop/__tests__/persist.test.ts`
- `.context/2026-09-18.buck-loop-extension/iterate-buck-loop-artifact-state.md`
- `.context/2026-09-18.buck-loop-extension/iterate-buck-loop-artifact-state-2.md`
- `.context/2026-09-18.buck-loop-extension/draft-commit.md`
- `.context/memory/buck-loop-phase2-build-2026-09-18.md`
- `.context/memory/buck-loop-phase2-review-2026-09-18.md`
- `.context/memory/index.md`
