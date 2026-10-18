---
status: active
date: 2026-09-11
subject: 2026-09-11.extension-activity-progress
topics: [phasing, extension-activity, omp, tui, spinner, widget]
source_plan: plan-extension-activity-progress.md
phases: 4
format: discrete
research: []
memory: []
---

# Phased Plan: Unified live activity for extensions

> Derived from [plan-extension-activity-progress.md](plan-extension-activity-progress.md)

## Overview

- **Total phases**: 4
- **Rationale**: The plan touches a new shared module (`extension-activity.ts`), a model-session seam (`omp-models.ts`), a subprocess module extraction (`subprocess.ts`), four long-running command migrations, and documentation. Sequencing the shared contract before the caller migrations keeps each phase verifiable on its own and prevents command-by-command drift in the UI behavior.
- **Estimated total effort**: medium-large; one phase per session is the realistic target.
- **Difficulty mix**: 1 easy, 1 medium, 1 medium, 1 medium.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Subprocess extraction | completed | easy | none | [phase-1-subprocess-extraction.md](phase-1-subprocess-extraction.md) |
| 2: Activity core | completed | medium | none | [phase-2-activity-core.md](phase-2-activity-core.md) |
| 3: Model runner wiring | completed | medium | none | [phase-3-model-runner-wiring.md](phase-3-model-runner-wiring.md) |
| 4: Command migration + docs | in-progress | medium | none | [phase-4-command-migration-docs.md](phase-4-command-migration-docs.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Phase 2's command migrations must call the new subprocess module; mixing subprocess extraction with UI work would dilute review scope. |
| Phase 2 → Phase 3 | HARD | `runOmpModelSession()`'s optional activity callback cannot be tested in isolation until `extension-activity.ts` defines the normalized event shape. |
| Phase 3 → Phase 4 | HARD | Caller migrations depend on the runner event normalization landing first; otherwise each command has to subscribe to SDK events itself. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
 (subprocess)  (activity)  (model runner)  (commands + docs)
```

**Legend:**
- `──→` = HARD dependency (blocking)

## Dependency details

- Phase 2 HARD-depends on Phase 1: subprocess capture moves before UI lifecycle work so the existing tests are preserved through a known-good seam.
- Phase 3 HARD-depends on Phase 2: `extension-activity.ts` defines the `ActivityEvent` union that `runOmpModelSession()` will emit.
- Phase 4 HARD-depends on Phase 3: each long-running command forwards events through the runner's normalized callback rather than subscribing to the SDK directly.

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

None. Every phase is sequentially gated by the shared module contract.

## Execution Order

1. Complete Phase 1, verify acceptance criteria.
2. Update phase file: `status: completed`, check acceptance criteria.
3. Update this overview: change status to `completed` in summary table.
4. Queue Phase 2, repeat.
5. Queue Phase 3, repeat.
6. Queue Phase 4, repeat.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save` to consolidate memory, draft commits, phase state, and review/iteration artifacts.
6. Run `/b-commit` to checkpoint durable state before moving to the next phase.
7. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

## Execution Checklist

- [x] Phase 1: Subprocess extraction — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 2: Activity core — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 3: Model runner wiring — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Command migration + docs — build → review → iterate if in-plan issues → docs if doc impact → save → commit — open: patch-coverage gate (89.9% vs 90%) and OMP TUI smoke; see phase-4 status note

## Notes

- Each phase is independently verifiable with the project's `npm test` and `/b-guardrails-check`; OMP TUI verification applies to phases 2, 3, and 4 (phase 1 is module-level only).
- Phase 4's "delete after clean cutover" step requires the migration to be observably correct in OMP interactive mode; do not delete `command-progress.ts` until OMP TUI smoke for the migrated commands passes.
- `extensions/b-flow/` and `extensions/b-grill-auto/` remain explicitly out of scope; do not adapt their renderer in any phase.
