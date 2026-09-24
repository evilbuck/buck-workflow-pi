---
status: active
date: 2026-09-23
subject: 2026-09-22.buck-loop-model-config
topics: [phasing, buck-loop, model-profiles, jev, buck-models]
research: []
memory: [buck-model-config-phasing-2026-09-23.md, buck-model-config-phase-1-save-2026-09-23.md, buck-model-config-phase-2-2026-09-23.md, buck-model-config-phase-2-save-2026-09-24.md, buck-model-config-phase-3-save-2026-09-24.md]
source_plan: plan-buck-loop-model-config.md
phases: 6
format: discrete
---

# Phased Plan: Configurable Model Profiles for Buck Workflow

> Derived from [plan-buck-loop-model-config.md](plan-buck-loop-model-config.md)

## Overview

- **Total phases**: 6
- **Rationale**: Resolution and lossless config I/O form the trust boundary; picker policy builds on it; loop, interactive, and setup adapters can then land independently before one documentation/proof join.
- **Difficulty mix**: 4 hard, 2 medium
- **User goal**: Engineers switch named profiles that map Buck stage groups to model-id sets and thinking levels, without silent host-model fallback.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|---|---|---|---|---|
| 1: Profile Config and Resolution | completed | hard | none | [phase-1-profile-config-and-resolution.md](phase-1-profile-config-and-resolution.md) |
| 2: TypeSafe Model Picker | completed | hard | none | [phase-2-typesafe-model-picker.md](phase-2-typesafe-model-picker.md) |
| 3: Loop Runtime Cutover | completed | hard | none | [phase-3-loop-runtime-cutover.md](phase-3-loop-runtime-cutover.md) |
| 4: Interactive Command Cutover | pending | hard | none | [phase-4-interactive-command-cutover.md](phase-4-interactive-command-cutover.md) |
| 5: `/buck-models` Command | pending | medium | none | [phase-5-buck-models-command.md](phase-5-buck-models-command.md) |
| 6: Documentation and End-to-End Proof | pending | medium | none | [phase-6-documentation-and-end-to-end-proof.md](phase-6-documentation-and-end-to-end-proof.md) |

## Dependency Matrix

| From → To | Type | Reason |
|---|---|---|
| Phase 1 → Phase 2 | HARD | Picker consumes resolved, availability-filtered stage candidates. |
| Phase 2 → Phase 3 | HARD | Loop work and choice require the shared picker contract. |
| Phase 2 → Phase 4 | HARD | Interactive switching requires the same picker contract. |
| Phase 1 → Phase 5 | HARD | The command must use the lossless config writer and resolver metadata. |
| Phases 3, 4, 5 → Phase 6 | HARD | Cross-path docs and proof must describe and exercise landed behavior. |

## Dependency Diagram

```text
Phase 1 ──→ Phase 2 ──┬──→ Phase 3 ──┐
   │                  └──→ Phase 4 ──┼──→ Phase 6
   └─────────────────────→ Phase 5 ──┘
```

**Legend:** `──→` is a HARD blocking dependency.

## Parallel Opportunities

- **Phase 3 ∥ Phase 4 ∥ Phase 5** after their dependencies complete.
  - Phase 3 owns `extensions/buck-loop/**`.
  - Phase 4 owns interactive switch behavior in `extensions/index.ts`.
  - Phase 5 owns `extensions/buck-models/index.ts` and only adds command registration to `extensions/index.ts`.
  - Caveat: Phases 4 and 5 both touch `extensions/index.ts`; separate agents need a semantic merge or should run sequentially.

## Execution Order

1. Phase 1 establishes config semantics and non-destructive writes.
2. Phase 2 establishes one shared Jev/random picker.
3. Complete Phases 3–5 after their dependencies; sequential order avoids shared-tree contention.
4. Phase 6 joins all paths with docs and end-to-end proof.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact with in-plan issues, run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` cycle. Run `/b-docs` before `/b-save` when review flags documentation impact.
5. Run `/b-save` so memory, draft commits, phase state, and review artifacts are durable.
6. Run `/b-commit` before moving to the next phase. One completed phase equals one commit.
7. If interrupted, leave the phase `in-progress`; resume from it and any active phase-specific iteration artifact.

## Execution Checklist

- [x] Phase 1: Profile Config and Resolution — build-hard → review → iterate/docs if needed → save → commit
- [x] Phase 2: TypeSafe Model Picker — build-hard → review → iterate/docs if needed → save → commit
- [x] Phase 3: Loop Runtime Cutover — build-hard → review → iterate/docs if needed → save → commit
- [ ] Phase 4: Interactive Command Cutover — build-hard → review → iterate/docs if needed → save → commit
- [ ] Phase 5: `/buck-models` Command — build → review → iterate/docs if needed → save → commit
- [ ] Phase 6: Documentation and End-to-End Proof — build → review → iterate/docs if needed → save → commit

## Notes

- Keep `parseModelRoles`, `mappingFromOmpRoles`, and the Settings API migration subject intact.
- `difficulty: hard` selects only the hard build prompt variant after this cutover.
- `/buck-loop` remains the supervisor and does not switch the parent model.
