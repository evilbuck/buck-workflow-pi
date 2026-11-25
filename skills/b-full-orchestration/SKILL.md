---
name: b-full-orchestration
description: Drive one Buck subject from its current stage through b-commit by orchestrating subagents. A phased plan is a sequence of runs; an unphased plan or current context is one run. Use when the user says full orchestration, take this plan through to commit, finish the buck workflow, or run the remaining stages.
---

# b-full-orchestration

You are the **orchestrator**. You sequence work. Stage work goes to subagents. A **run** is one phase walked from its current stage through `b-commit`. An unphased plan, or a quick fix with no plan, is one run. Phases are runs inside this orchestration, in dependency order, on this worktree.

Step the machines in [`references/stage-map.md`](references/stage-map.md). Its ordered tables are the only route, and its resolution table maps every dispatch target to a loadable procedure — including `b-build-hard` (the `b-build` skill at hard difficulty) and `b-commit` (the `git-commit` skill). This skill does not enable `omp_execution`. Do not type `orchestrate`, `workflow`, or `/goal set`.

## Inputs

The argument is a subject folder, a `plan-*.md`, a `phase-N-*.md`, or the task in current context. Empty means current context.

Apply `skills/_shared/subject-resolution.md` when no path is given. Multiple subjects: stop and ask. That is the only selection pause, and it is separate from automatic phase ordering — never re-ask it per phase. Do not ask which phase: every incomplete phase is a run, in dependency order.

## Procedure

Do not yield between stages or runs. Save and commit are in scope; do not ask before them. A missing subagent tool is a blocker: stop and name it. Do not execute stages inline.

1. **Resolve the slice.** Subject, plan, or current-context task is named. Done when you can point at the subject folder or quote the task that will create one.
2. **Detect the position.** Step the outer machine. Verified completion for a slice is checked before its original task label. Artifacts and retained revisions win over `orchestration.md` and over conversation memory. Done when the first true guard names the next edge and the run list is written down.
3. **Leave a protected branch before the first edit.** If `HEAD` is `main`, `master`, `dev`, or `develop`, create `feat/<slug>` from the subject name (date prefix stripped) or the task. Do not pass `--force`. A dirty tree that blocks the switch is a blocker. Do not stash or reset.
4. **Pre-run edges.** While the outer edge is `brainstorm`, `explore`, `research`, `plan`, `plan-update`, `phase`, `grill`, or `present`, dispatch that stage, verify its artifact, and return to `detect`. A clear task with no named missing fact plans directly; answered research returns to plan revision, never to another research pass. Done when the edge is `run`, `backlog`, `done`, or `blocked`.
5. **Sequence runs.** A `run` edge dispatches one run worker. That worker steps the run machine. Wait for it. Re-read its evidence: the retained review revision through `workflow_state`, and the commit — a newly returned commit must match the current tip, while a historical phase checkpoint counts wherever it sits in history. Then take the outer `run →` row: on `run → detect` re-detect and continue; on `run → blocked` stop and record the blocker. Start the next run only after this run's commit is the tip. Done when the outer edge is `done`, `backlog`, or `blocked`.
6. **Relay material questions once.** When any worker returns a material unanswered question, relay it to the user, stop, and resume the same subject with the answer. The answer advances the subject; it never restarts intake.
7. **Close.** When the outer edge is `backlog`, dispatch `b-backlog` and stop. When it is `done`, stop. Do not open a new plan in this invocation.

Write `orchestration.md` beside the plan (the same place `review-*.md` lands) after every verified transition. Hint only: on resume, re-detect. If the active store is not repo-files, retain that note through `workflow_state` and do not also mirror it.

## Dispatch

Use the harness subagent tool (`task` on OMP/Pi). One stage or one run per subagent. `solutionSpace` stays narrow: the named skill is the procedure. Do not impersonate `/buck-loop`, and do not disable a stage skill's own acceptance verification.

Stage brief: use the canonical stage brief in [`references/stage-map.md`](references/stage-map.md) (populated from its stage target resolution table).

Run brief:

```text
You are the run worker for this slice only. Load skills/b-full-orchestration/references/run.md.
Do not load SKILL.md. Do not sequence other phases.
Subject: <subject folder or "none yet">
Slice: <phase path, plan path, or task>
Start-stage hint: <stage>
Final run: <yes|no>
Caps: iterate 3, guardrails fixes 2 — reconstruct prior counts from slice evidence;
a restart does not reset them.
Return the commit SHA, retained revision ids, artifact paths, and any out-of-plan findings.
```

Review workers stay read-only except the review artifacts their skill writes. After a review worker returns, reject the result if source files changed.

## Evidence

A stage is verified only when you re-read the artifact it names. A review verdict is verified only when the run worker's retained `review` revision reads back through `workflow_state` and its fingerprint matches the slice. A commit is verified only when `git` shows that SHA on `HEAD`. A subagent summary is not evidence.

## Stop

Stop, record the blocker in `orchestration.md`, and do not commit when:

- a cap is hit, counting reconstructed counts (iterate 3, guardrails fixes 2, ideation returns 2)
- closeout (`close-verified`) returns blockers
- the worktree has unrelated dirty paths the scoped commit cannot separate
- a stage needs a human (credentials, dashboard, cutover)
- the subagent tool is missing
- no guard matches; the named missing proof is the blocker

Do not weaken a gate to finish. Prefer a safe refusal over an unprovable commit.

## Done

Every run's slice is committed. A plan-backed final run has `close-verified` success (`effectiveState` completed). Out-of-plan findings are backlogged or named in the final report. `orchestration.md` says the orchestration is completed.
