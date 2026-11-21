---
status: active
date: 2026-11-20
subject: 2026-11-20.bun-typescript-migration
topics: [phasing, extension-timeout, token-attribution, typescript, bun, release-safety, lockfile]
source_plan: plan-migration-followups.md
phases: 4
format: discrete
---

# Phased Plan: Bun-migration follow-ups

> Derived from [plan-migration-followups.md](plan-migration-followups.md)

## Overview

- **Total phases**: 4
- **Rationale**: >8 implementation steps across extension runtime, type surface, release tooling, and dependency hygiene — four independently verifiable slices with only one SOFT edge.
- **Estimated total effort**: Phase 1 dominates (red/green store-behavior change + live restart proof); Phases 2–4 are bounded cleanups.
- **Difficulty mix**: 1 hard, 1 medium, 2 easy

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: token-attribution `message_end` timeout | pending | hard | none | [phase-1-token-attribution-timeout.md](phase-1-token-attribution-timeout.md) |
| 2: zero TypeScript diagnostics | pending | medium | none | [phase-2-zero-tsc-diagnostics.md](phase-2-zero-tsc-diagnostics.md) |
| 3: release script fails closed | pending | easy | none | [phase-3-release-fails-closed.md](phase-3-release-fails-closed.md) |
| 4: lockfile and remnants | pending | easy | none | [phase-4-lockfile-remnants.md](phase-4-lockfile-remnants.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 2 → Phase 4 | SOFT | `astro.config.ts` must typecheck under the widened tsconfig include; Phase 4 can proceed on the narrow include and re-verify |

## Dependency Diagram

```
Phase 1        Phase 2 - -→ Phase 4        Phase 3
(timeout)      (tsc clean)   (lockfile)    (publish)
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)
- Independent phases shown side by side

**Dependency details:**
- Phase 4 SOFT-depends on Phase 2: re-widened tsconfig include must accept `astro.config.ts`. No other cross-phase edges: Phases 1, 2, 3 share no files.

## Parallel Opportunities

- **Phase 1 ∥ Phase 2 ∥ Phase 3**: No shared files, no build-order dependency.
  - *Rationale*: token-attribution extension files, tsconfig/test-file typing, and `scripts/publish.ts` are disjoint.
  - *Caveat*: all three run `bun run guardrails:check` — sequence commits if run by separate agents to avoid tree contention.
- Phase 4 can start after (or alongside) Phase 2 with the narrow tsconfig; re-verify the widened include once Phase 2 lands.

## Deferred Assumption Ownership

- **A1** (Bun type strategy) → Phase 2: measures `@types/bun` fallout vs scoped declarations.
- **A2** (`message_end` may stop awaiting persistence) → Phase 1: wire tests assert flush-point warnings.
- **A3** (single `bun.lock` lockfile) → Phase 4: frozen-lockfile install validates.
- **A4** resolved in the parent plan; no phase action.

## Execution Order

1. Complete Phase 1 (user-reported timeout, front-loaded risk), verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in the summary table
4. Queue Phase 2, repeat through Phase 4 (Phases 2 and 3 may run in parallel; Phase 4 last)

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save` to consolidate memory, draft commits, phase state, and review/iteration artifacts.
6. Run `/b-commit` to checkpoint durable state before moving to the next phase.
7. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [ ] Phase 1: token-attribution `message_end` timeout — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: zero TypeScript diagnostics — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: release script fails closed — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: lockfile and remnants — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Phase 1 live proof requires an OMP session restart plus a normal turn; check the new omp log before declaring the timeout fixed. If timeouts persist, the file-store memoization contingency becomes its own plan (out of scope).
- Final verification across all phases: `bun run test`, `bunx --bun playwright test tests/e2e/packed-report.spec.ts --project=chromium`, `bun --bun tsc --noEmit`.
