---
status: active
date: 2026-10-26
subject: 2026-10-26.git-cleanup-skill
topics: [phasing, git, worktree, branch-cleanup, landedness]
source_plan: plan-git-cleanup.md
phases: 3
format: discrete
---

# Phased Plan: Landed worktree and branch cleanup

> Derived from [plan-git-cleanup.md](plan-git-cleanup.md)

## User Goal

A developer with many local worktrees and branches can delete the ones whose code is already in the integration branch — including after a squash, rebase, or rewritten history — and then decide, from a one-line description and a planning / building / finished label, what to do with everything that is not proven landed.

Inherited unchanged from the parent plan; the three phases are slices of one user-facing outcome.

## Overview

- **Total phases**: 3
- **Rationale**: the delete path must be reviewed before the published redirect, and the classifier must exist before any delete flag.
- **Estimated total effort**: 3 sessions, one commit each
- **Difficulty mix**: 2 hard, 1 medium

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Classifier JSON | completed | hard | none | [phase-1-classify-json.md](phase-1-classify-json.md) |
| 2: Apply deletes | pending | hard | none | [phase-2-apply-deletes.md](phase-2-apply-deletes.md) |
| 3: Skill, redirect, and docs | pending | medium | none | [phase-3-skill-redirect-docs.md](phase-3-skill-redirect-docs.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | `--apply` re-runs classify and deletes only the fresh `auto-delete` intersection. The refusal tests need that disposition contract. |
| Phase 2 → Phase 3 | HARD | The skill and the `git-clean-orphans` redirect describe the landed delete CLI. The plan forbids landing the delete script in the same unreviewed step as the docs redirect. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: apply is a flag on `skills/git-cleanup/scripts/classify.ts`, not a second script. Shared file: that script and its test.
- Phase 3 HARD-depends on Phase 2: procedure text must match the reviewed `--apply` behavior. Phase 3 does not edit the script.

## Parallel Opportunities

- None. The chain is fully sequential. Classify, delete, and the published redirect share one contract and must land in that order.

## Execution Order

1. Complete Phase 1, verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2, repeat...

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. No phase sets `omp_execution`. The first turn is a plain Buck build. Do not type `orchestrate`, do not type `workflow`, and do not run `/goal set`. Three phases is below the orchestrate threshold (≥ 4 phases with a HARD dependency).
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [ ] Phase 1: Classifier JSON — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Apply deletes — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Skill, redirect, and docs — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Phase 2 is blocked on backlog item `phase-1-refname-collision`: the Phase 1 classifier uses `%(refname:short)` as canonical branch identity, so a tag/branch name collision puts the integration branch into `auto-delete`. `--apply` must not run until that is fixed.

- Parent assumptions A-1 through A-6 are validated. None are deferred or blocking, so no phase owns an assumption-validation task.
- Do not run `--apply` against this checkout while landing the skill. Classify-only smoke should show `feat/git-cleanup-skill` as `skip`.
- SQL recall on 2026-10-26 (`git@github.com:evilbuck/buck-workflow-pi.git`, query text `git cleanup worktree branch landedness classify apply skill`) returned no prior cleanup-skill decision. The storage-adapter publication closeout (`01a1434f-f7ff-7794-8d51-7809e00359c6`) rejects patch-id alone for rewritten history. That agrees with plan A-2; it is not a new phase constraint.
- Out of scope for every phase: remote deletion, reflog expiry, `git gc`, managed skills outside this repo, the Codex curated bundle, and `/worktrees-active-recap`.
