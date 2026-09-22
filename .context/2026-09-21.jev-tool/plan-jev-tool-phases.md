---
status: active
date: 2026-09-21
subject: 2026-09-21.jev-tool
topics: [phasing, jev, typesafe, omp-extension, b-phase, difficulty, model-routing]
source_plan: plan-jev-tool.md
memory: [jev-tool-phasing-2026-09-21.md]
phases: 3
format: discrete
---

# Phased Plan: Jev Tool and Boolean Phase Difficulty

> Derived from [plan-jev-tool.md](plan-jev-tool.md)

## Overview

- **Total phases**: 3
- **Rationale**: Nine implementation steps span a new external SDK/tool boundary, two runtime consumers, a cross-domain model-routing seam, a canonical skill plus bundled copy, documentation, and live external-service proof. The shared `extensions/index.ts` seam and final end-to-end smoke require sequential integration.
- **Estimated total effort**: three agent sessions, one per phase.
- **Difficulty mix**: 2 hard, 1 medium
- **User goal (inherited by all phases)**: Engineers using OMP can offload “is this phase hard?” to Jev while the main model still designs phases, and the generic registered tool remains reusable for later classifications.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Jev Tool Contract | completed | hard | none | [phase-1-jev-tool-contract.md](phase-1-jev-tool-contract.md) |
| 2: Binary Difficulty Cutover | pending | hard | none | [phase-2-binary-difficulty-cutover.md](phase-2-binary-difficulty-cutover.md) |
| 3: b-phase Integration and Proof | pending | medium | none | [phase-3-b-phase-integration-and-proof.md](phase-3-b-phase-integration-and-proof.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Both phases change `extensions/index.ts`; Phase 2 must preserve and verify the registered Jev wire while replacing phase-difficulty parsing. |
| Phase 1 → Phase 3 | HARD | The skill protocol and live smoke require the real registered `jev` tool and its fail-closed response contract. |
| Phase 2 → Phase 3 | HARD | The skill, docs, and smoke must target the final `hard | not-hard` parser and model-routing behavior. |

## Dependency Diagram

```text
Phase 1 ──→ Phase 2 ──→ Phase 3
    └──────────────────→
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)
- No edge = NONE

**Dependency details:**
- Phase 2 is structurally separable from the TypeSafe client, but it shares `extensions/index.ts`; sequencing prevents two phases from independently rewriting the same registration and auto-switch surface.
- Phase 3 joins both runtime slices. It cannot prove Jev-scored phase output until the tool and binary difficulty consumers both exist.

## Parallel Opportunities

None. Phase 1 and Phase 2 share `extensions/index.ts`; Phase 3 is their integration join.

## Execution Order

1. Complete Phase 1 and verify the registered generic Jev tool.
2. Complete Phase 2 and verify binary phase parsing without changing review Hardness.
3. Complete Phase 3 and verify the skill, docs, Codex bundle parity, and live end-to-end behavior.

`omp_execution` is omitted (`none`). The work is a short HARD chain with shared files; use the standard per-phase Buck cycle rather than autonomous fan-out.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow`, drop the matching keyword on the first turn before the build command. If it is `goal`, run `/goal set "<plan User Goal>" --budget <omp_goal_budget>` first instead. Either way, see the phase file's “Per-Phase Execution Loop” for the precondition.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [x] Phase 1: Jev Tool Contract — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Binary Difficulty Cutover — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: b-phase Integration and Proof — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- `DifficultyTier` and code-review-iteration review Hardness remain `easy | medium | hard`. Only phase-file difficulty becomes binary.
- Legacy phase files containing `easy` or `medium` must parse as `not-hard`; historical files are not rewritten.
- The eval twin and buck-loop chooser migration remain out of scope.
- `plugins/buck-workflow/skills/b-phase/SKILL.md` must be recopied from the canonical skill in Phase 3 so Codex bundle parity remains green.
