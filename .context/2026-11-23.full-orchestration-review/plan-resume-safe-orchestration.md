---
status: active
date: 2026-11-23
subject: 2026-11-23.full-orchestration-review
topics: [subagents, orchestration, resume, scoped-commits]
research: []
iterations: [iterate-full-orchestration-review.md]
spec: null
memory: []
---
# Plan: Make full orchestration safe to start and resume

## User Goal
> Essentially, what I wanted to do is orchestrate sub agents to complete a phased plan or an unfazed plan at any state, or even take in context and build through the whole buck workflow.

## Goal
Given the same slice and the same evidence, a fresh supervisor chooses the same next unfinished stage. It neither repeats completed work nor commits work that was not reviewed, verified, and attributed to that slice.

## Context used / assumptions
The [source review](review-b-full-orchestration.md) traced the current instructions; it did not execute the command. The defects are in the handoffs between working stage skills. `prompts/b-build-hard.md` and `prompts/b-commit.md` identify the two command aliases; `skills/b-review/SKILL.md` allows a clean pass without a file; `skills/b-build/SKILL.md` assigns unphased status to the supervisor. `skills/git-commit/SKILL.md` consumes prepared changes; it does not stage them.

## Scope and affected files
One unphased change. Edit only these files under `skills/b-full-orchestration/`:

| File | Responsibility |
|---|---|
| `SKILL.md` | Supervisor authority, stage target resolution, material questions, and the worker briefs. |
| `references/stage-map.md` | Authoritative ordered guards for intake, normal progress, restart, and stop. Replace the two detailed routing diagrams with three short worked examples. |
| `references/run.md` | Run-worker effects: retain evidence, finalize acceptance, prepare an isolated commit, and verify it. Refer to the stage map; do not restate its routing rules. |

Keep one run per phase in dependency order on the shared worktree, one run per unphased plan or planless fix, independent review, and existing retry caps. No new runtime, extension, database schema, wrapper, or general rewrite of Buck stage skills. Do not enable OMP modes, push, or merge as part of this change.

## Implementation steps
1. **Resolve the worker's actual procedure.** Use the canonical skill for ordinary stages. Map `b-build-hard` to `skills/b-build/SKILL.md` with hard difficulty, and `b-commit` to `skills/git-commit/SKILL.md` with the harness's scoped commit mechanism. Preserve stage arguments, including grill mode. Pass resolved subject, slice, and decision authority to each worker. An approved slice needs no routine reapproval; a worker returns a material unanswered question to the supervisor instead of guessing or waiting invisibly. Do not impersonate `/buck-loop` or disable the build skill's acceptance verification.
2. **Make intake progress.** A new, clear non-fix task with sufficient context goes directly to planning. Explore/research only for a named missing fact; after it is answered, create or **revise the existing plan**, rather than requesting the same evidence again. A vague idea goes to brainstorm; a newly formed task then proceeds to planning. The supervisor relays a genuine scope decision to the user and resumes the same subject with their answer. Check the single-subject choice separately from automatic phase ordering. A quick fix with no feature scope does not acquire a plan.
3. **Bind stage evidence to the work.** The reviewer returns its report without changing source. The run worker retains a `review` artifact through `workflow_state` for every verdict, including clean pass: stable subject/slice identity, review cycle, baseline commit, fingerprint of the implementation actually reviewed, verdict, gate evidence, docs/how-to impact, in-plan iterate reference, and out-of-plan findings. Compute the fingerprint from the slice’s actual paths/content (including tracked deletions and new files), not `HEAD` alone or a filename list. Exclude the report and bookkeeping it generates. Independently inspect cited evidence and read back the retained revision before advancing. Missing, mismatched, or stale proof is not a pass. Keep `orchestration.md` a hint, not a second authority.
4. **Use the same prerequisite order on first entry and restart.** Match verified completion for this exact slice before its original task label: a valid historical phase checkpoint is not required to remain at the tip after later phases; a newly returned commit must match the current tip. Check the saved state and final subject closure separately. Reuse a current review and completed downstream effects; rerun only missing or invalidated prerequisites. An active in-plan correction routes to iteration; “quick fix” starts iteration only for a fresh fix. Persist/reconstruct retry counts from slice-specific evidence so restarting does not reset the caps. No matched guard, ambiguous evidence, a failed required gate, or an exhausted cap yields a named blocker, never `done`.
5. **Finalize before committing.** The run worker reads the canonical acceptance result; it may set an unphased plan to completed only for a non-empty, fully verified checklist. It never checks boxes on the builder’s behalf. Finalize phase status before its commit too. Save; on a final plan-backed run, inspect lifecycle and invoke `close-verified` if closure is pending. Reinspect and require verified completion before preparing the commit. A saved artifact is not closure proof. Intermediate phases must leave the subject open; quick fixes do not require plan-backed closure. Return actual blockers, not a successful completion with a blocker list.
6. **Give commit preparation one owner.** The run worker constructs the exact candidate patch after save and closure, including attributable source and required repo-projected records. Use the harness's isolated, scoped commit facility where available; pass the prepared selection and expected parent to the commit stage, not the live shared index. Where a prepared selection cannot cross a worker boundary, pass a verifiable description of the exact patch and require the commit worker to reconstruct and compare it before committing. Never equate a declared path with ownership of every hunk. Preserve unrelated staged, unstaged, and overlapping edits. If ownership, parent, or candidate no longer matches, stop before mutation. Check the resulting commit’s parent, patch, and SHA; do not stamp tracked completion state afterward. External-adapter records remain revision references, not checkout mirrors.

## Acceptance criteria
- [x] All 17 current dispatch targets resolve; hard build receives hard difficulty and commit receives only the verified slice. No synthetic skill directories are required.
- [x] A well-specified feature needs no research artifact to reach planning. A material unanswered question reaches the user once; the answer advances the same subject. Existing-plan research returns to plan revision.
- [x] A fresh worker can resume after a clean review without repeating it; changing reviewed implementation bytes invalidates the pass even if `HEAD` is unchanged. An open in-plan issue still blocks save/commit.
- [x] A completed quick fix does not re-enter iterate or produce a second commit. A previously committed phase is skipped while later phases continue in dependency order. Restart does not replenish spent retries.
- [x] An unphased final plan cannot commit with absent/open acceptance or an open subject. Saved-but-not-closed resumes at closure; already verified closure is reused. Intermediate phases and planless fixes retain their distinct closure rules.
- [x] Starting with only unstaged slice edits produces one scoped commit. Unrelated staged/unstaged edits remain intact; inseparable ownership or a failed closure produces no commit. The final commit includes required repo-projected completion changes.
- [x] Only the ordered tables define routing; the three examples below illustrate them and agree with the observed next stage.

Acceptance wrap-up (2026-11-23, jev via judge, one noul per line): c1 0.65, c2 0.31, c3 0.20, c4 0.12, c5 0.24, c6 0.31, c7 0.63 — all below the 0.7 threshold, so no box was ticked. Judged gaps: no live hard-difficulty dispatch (C1, static enforcement only); in-plan-issue → iterate block not live-exercised, only open-criterion at closeout (C3); no dedicated spent-cap restart trial (C4); remaining clauses scored on narrative evidence the judge could not independently re-read.

Acceptance wrap-up (2026-11-25, native TypeSafe `jev-1.14.0` via `extensions/jev-tool/index.ts:runJev`, one noul per line, full updated skill files + static check + raw trial evidence supplied in `state.evidence`): c1 0.75 (`[x]`), c2 0.87 (`[x]`), c3 0.93 (`[x]`), c4 0.88 (`[x]`), c5 0.85 (`[x]`), c6 0.83 (`[x]`), c7 0.73 (`[x]`) — all seven >= 0.7, so all seven boxes stamped `[x]`. Trial log and raw evidence: `verify-fixture-exercise.md` (§1–§10).

## Verification
Check aliases against the actual wrapper and skill files. Then exercise the revised skill against a disposable feature-branch checkout with workers enabled. Capture dispatch order, artifact revisions, lifecycle inspection, and commit diff for each case. Restart with a fresh worker that has the same durable artifacts but no chat history; do not treat a prose walk-through as an execution pass.

| Worked example to keep in the skill | Observable result |
|---|---|
| Clear feature, familiar code, no prior artifacts | First stage is `b-plan`; the unphased run finishes without invented research or an approval pause for save/commit. |
| Two dependent phases; interrupt after phase 1's clean review | Unchanged content reuses the retained pass, commits phase 1, then starts phase 2. In a separate trial edit reviewed content without changing `HEAD`: review runs again. |
| Final unphased plan; interrupt after save | With closure pending, the next effect is closure, not commit. Open a criterion: no commit. With closure verified and unrelated work staged: exactly the slice lands and the unrelated work stays staged. |

Also exercise a finished quick fix twice (no new worker or SHA on the second invocation), an answered planning question, and same-file inseparable edits (no change to index, worktree or `HEAD`). Compare scoped diffs before/after, including untracked content, rather than relying on a clean status. Record blocked fixture runs explicitly if a required worker, judge, or check is unavailable.

## Decision Closure
Keep the supervisor as a skill. The stage table selects; workers execute; retained evidence and Git establish what happened. Prefer a safe refusal over an unprovable commit. Exclude global stage behavior changes. First bounded action: repair dispatch and intake in the supervisor and stage map.

## Assumptions Ledger
- **A-1 — validated; blocking: false.** The standalone command names are not all skill directory names. Evidence: the two wrappers named above.
- **A-2 — validated; blocking: false.** A normal review can succeed without a durable pass artifact. Evidence: `skills/b-review/SKILL.md`, “When review passes.” This makes retention the run worker’s responsibility.

## Material Risks
| Failure mode and impact | Mitigation | Fallback and validation |
|---|---|---|
| A stale pass authorizes unreviewed changes. | Bind verdict to slice content, not the branch tip alone. | Re-review on mismatch. Change one source file with the same `HEAD` and verify the old pass cannot advance. |
| Commit consumes unrelated edits or leaves the index altered. | Isolate the candidate and compare exact scope before and after commit. | Refuse if attribution is ambiguous. Exercise both disjoint staged work and overlapping edits; compare the unrelated changes, not just filenames. |
| Interrupted save is mistaken for completed closure. | Inspect lifecycle independently on entry and before final commit. | Leave the subject open on refusal. Restart the failed-closure fixture and verify no commit was created. |

## Execution Instructions
Build this as one unit with `/b-build`; use `/b-review` against this plan, `/b-iterate` for in-plan defects, then `/b-docs` or `/b-howto` only if flagged, `/b-save`, and `/b-commit`. Test the revised orchestrator in the disposable checkout, not by asking the defective version to supervise its own repair.
