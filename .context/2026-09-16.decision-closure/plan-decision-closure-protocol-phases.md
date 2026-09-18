---
status: active
date: 2026-09-16
subject: 2026-09-16.decision-closure
topics: [phasing, decision-closure, assumptions, risk, rollback, workflow]
source_plan: plan-decision-closure-protocol.md
phases: 5
format: discrete
---

# Phased Plan: Decision Closure Across Buck Workflow

> Derived from [plan-decision-closure-protocol.md](plan-decision-closure-protocol.md)

## Overview

- **Total phases**: 5
- **Rationale**: Nine implementation steps across a new shared protocol, four grill variants, plan, phase, build, review, methodology docs, and the Codex bundle. Schema must freeze before consumers; proof cannot run until consumers exist.
- **Estimated total effort**: five agent sessions (one per phase). After Phase 1, Phases 2–4 can run in parallel.
- **Difficulty mix**: 1 hard, 4 medium
- **User goal (inherited by all phases)**: Buck Workflow users can see and validate material decisions, assumptions, and rollback posture before autonomous execution, without slowing routine work.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Shared Protocol | pending | hard | none | [phase-1-shared-protocol.md](phase-1-shared-protocol.md) |
| 2: Grill Variants | pending | medium | none | [phase-2-grill-variants.md](phase-2-grill-variants.md) |
| 3: Plan and Phase | pending | medium | none | [phase-3-plan-and-phase.md](phase-3-plan-and-phase.md) |
| 4: Build and Review | pending | medium | none | [phase-4-build-and-review.md](phase-4-build-and-review.md) |
| 5: Narrative and Proof | pending | medium | none | [phase-5-narrative-and-proof.md](phase-5-narrative-and-proof.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Grill skills load the shared protocol; they must not invent a second schema. |
| Phase 1 → Phase 3 | HARD | Plan/phase ledgers instantiate Phase 1 field names, statuses, and ID rules. |
| Phase 1 → Phase 4 | HARD | Hard-mode sequence and review matrix rows are defined in the protocol. |
| Phase 2 → Phase 5 | HARD | Proof scenarios and originality review need the four grill closeouts. |
| Phase 3 → Phase 5 | HARD | Narrative and phasing scenarios need plan/phase consumers. |
| Phase 4 → Phase 5 | HARD | Build/review scenarios and bundle parity need execution-side consumers. |
| Phase 3 → Phase 4 | SOFT | Review/hard-mode read plan artifacts; shape lives in Phase 1, so Phase 4 can start against the protocol. |

## Dependency Diagram

```
                 ┌──→ Phase 2 (grills) ──────────┐
Phase 1 ─────────┼──→ Phase 3 (plan+phase) - -→ Phase 4 (build+review)
 (protocol)      │         │                     │
                 │         └─────────────────────┤
                 └───────────────────────────────→ Phase 5 (docs+proof)
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub against Phase 1 headings)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: closeout sections instantiate the protocol rather than restating it.
- Phase 3 HARD-depends on Phase 1: assumption IDs and statuses are frozen in the protocol.
- Phase 4 HARD-depends on Phase 1: minimal-change sequence and closure-ready rules.
- Phase 4 SOFT-depends on Phase 3: completion matrix talks about plan/phase ledgers whose headings Phase 1 already named.
- Phase 5 HARD-depends on Phases 2, 3, and 4: join for narrative, full bundle parity, and behavior scenarios.

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

- **Phase 2 ∥ Phase 3 ∥ Phase 4** after Phase 1 — disjoint skill directories (`b-grill*`, `b-plan`/`b-phase`, `b-build`/`b-review`).
  - *Rationale*: each only loads `skills/_shared/decision-closure.md`.
  - *Caveat*: do not fork field names. If a heading must change, edit the protocol (Phase 1) first. Phase 4 should cite Phase 1 headings if Phase 3 has not landed.
- **Not parallelizable**: Phase 1 (schema gate); Phase 5 (join).
- **Within Phase 2**: four grill files share one closeout shape — prefer a single agent so the section is consistent. Do not fan out.

## Execution Order

1. Complete Phase 1, verify acceptance criteria.
2. Update that phase file: `status: completed`, check acceptance criteria.
3. Update this overview: change status to `completed` in the summary table.
4. Queue Phase 2, 3, and/or 4 (parallel-safe). Repeat the mini-cycle per phase.
5. Queue Phase 5 only after 2, 3, and 4 are completed.

`omp_execution` is omitted (`none`). `/skill:b-loop` may later stamp `orchestrate` if you want a no-yield run across the HARD chain; this phasing does not stamp a loop.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow`, drop the matching keyword on the first turn before the build command. If it is `goal`, run `/goal set "<plan User Goal>" --budget <omp_goal_budget>` first instead. Either way, see the phase file's "Per-Phase Execution Loop" for the precondition.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [ ] Phase 1: Shared Protocol — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Grill Variants — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Plan and Phase — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Build and Review — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 5: Narrative and Proof — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Content constraint from the parent plan: ported skill text must not contain the forbidden term in any casing; no complete donor sentence, table, template, or branded label.
- `skills/` is canonical. Each implementation phase syncs **its** shipped directories into `plugins/buck-workflow/skills/`. Phase 5 re-checks full parity. Do not add bundled `b-grill-auto`.
- Prompt/command wrappers stay thin loaders. No standalone risk skill, no global approval layer, no `extensions/b-grill-auto/` edits.
- Light Grill remains discretionary. `b-review` remains an implementation review. `b-build-hard` remains a mode of `b-build`.
- These phases are docs/skill-contract work. Expect the docs-only deterministic-check skip unless a non-markdown path changes.
- Grill decision-domain metadata continues to feed `b-phase`; closure records are additive and body-based so existing readers stay compatible.

## Risks Carried from Parent Plan

| Risk | Mitigation | Owning phase |
|---|---|---|
| Conditional closure becomes routine ceremony | Explicit triggers + skip path; Phase 5 smoke that a low-risk plan asks nothing extra | 1, 3, 5 |
| Skills disagree on assumption status | One shared file; consumers reference rather than restate | 1, 2, 3, 4 |
| Auto-grill output too thin for a native record | Additive body-based closeout; `b-plan` synthesizes when upstream is absent | 2, 3 |
| Donor language leaks | Re-author from the behavioral contract; forbidden-term scan; originality review | 1, 5 |
| Canonical vs Codex drift | Per-phase full-directory sync; Phase 5 `diff -rq` | 1–5 |
| Review overreaches into plan-quality review | Matrix rows limited to blocking assumptions and declared rollback/fallback evidence | 4 |
