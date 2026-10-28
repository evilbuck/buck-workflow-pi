---
status: pending
phase: 2
order: 2
plan: plan-git-cleanup.md
phases_overview: plan-git-cleanup-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Delete only the fresh proven-landed clean set, and refuse a stale name, a failed worktree remove, and --force."
files:
  - skills/git-cleanup/scripts/classify.ts
  - skills/git-cleanup/scripts/classify.test.ts
from_plan_steps: [7]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `--apply` re-runs classify and deletes only names in the intersection of the requested set and the fresh `auto-delete` set."
  - "[ ] A name the second classify does not mark `auto-delete` is not removed."
  - "[ ] Auto-delete worktrees are removed with `git worktree remove` and never `--force`. If remove fails, that branch is not deleted."
  - "[ ] After a successful worktree remove, `git branch -d` is used when the tip is an ancestor of the base; `git branch -D` is used only when the fresh result still says `auto-delete`."
  - "[ ] The unique-`.context` fixture (code contained, `.context/notes.md` differs) stays `ask` and `--apply` does not remove it."
  - "[ ] Dirty or untracked porcelain is not removed. No apply argv contains `--force`."
  - "[ ] `git worktree prune` runs only for registrations already marked prunable. It does not delete a directory."
  - "[ ] Current checkout and the integration branch remain `skip` under `--apply`."
  - "[ ] No network write, no `git reflog expire`, no `git gc`, no `git push`."
completed_at: null
completed_by: null
---

# Phase 2: Apply deletes

## Context

Parent user goal: a developer can delete local worktrees and branches whose code is already in the integration branch — including after a squash, rebase, or rewritten history — and then decide, from a one-line description and a planning / building / finished label, what to do with everything that is not proven landed.

Phase 1 owns the classifier and must be completed first. This phase adds the only delete path. The skill and the `git-clean-orphans` redirect stay in Phase 3 so the delete script is reviewed before the published contract changes.

Parent assumptions A-1 through A-6 stay validated. No deferred assumption is owned here. A-4 (delete the proven set without a second per-item confirmation) is what `--apply` implements; the ask list is still not deleted.

## Blocking prerequisite

Phase 1 left one reproduced defect below the iteration waterline: `classify.ts` uses `%(refname:short)` as canonical branch identity, so a tag whose name collides with a branch name makes Git emit that branch as `heads/main`. The integration-branch skip check then misses it and the integration branch is classified `auto-delete`. `--apply` must not run against a classifier with that defect, because the delete set is exactly the set this bug corrupts.

Fix it first (`.context/backlog/items/phase-1-refname-collision.md`): use full `%(refname)` and strip exactly `refs/heads/`, and add the integration-protection and worktree-deduplication regressions. Then implement this phase.

## Implementation Details

Extend `skills/git-cleanup/scripts/classify.ts`. Do not add a second script. Same process rules: `promisify(execFile)` from `node:child_process`, argv only, no shell.

`--apply` (optional list of names; omitted means the fresh `auto-delete` set):

1. Run the Phase 1 classifier again. Do not trust a previous JSON file.
2. Delete only the intersection of the requested names and the fresh `auto-delete` set. A requested name that the second classify marks `ask` or `skip` is reported and left in place.
3. For each surviving worktree: `git worktree remove <path>` with no `--force`. If that command fails, do not delete that branch. Leave the directory on disk.
4. Then delete the branch: `git branch -d <name>` when the tip is an ancestor of the base; otherwise `git branch -D <name>` only because the fresh result still says `auto-delete`. Never `-D` a name that failed the second classify.
5. After the proven deletes, `git worktree prune` only for registrations the fresh classify already marked prunable. That drops a stale registration whose gitdir is gone. It is not directory removal.
6. No network write. Fetch stays in the classify path and is not a write. Do not call `git push`, `git reflog expire`, or `git gc`.

Stdout remains one JSON document. Add an `applied` array of `{ "name", "action", "ok" }` and a `refused` array of `{ "name", "reason" }` so a stale name is visible. Do not change Phase 1 field names.

The agent must not be the thing that constructs `git branch -D` or `git worktree remove --force`. Those strings do not appear in the skill until Phase 3; in this phase they must not appear in apply argv except the conditional `git branch -D` above.

## Risks

- Classify/apply race: a branch gains a unique commit after an earlier report. Mitigation: apply calls classify again and deletes only the fresh intersection. Validation: a test whose second classify returns `ask` for a name the caller passed.
- Unique `.context` discarded because code containment was treated as sufficient. Mitigation: A-3 still forces `ask`; the notes fixture must survive `--apply`.
- `git worktree remove --force` or `rm -rf` on a dirty tree. Mitigation: no `--force` in argv; a failed remove skips the branch delete. A refused remove leaves the directory.
- False ancestor test authorizing `git branch -d` on a squash. Mitigation: non-ancestor proven tips use `-D` only while the fresh disposition is still `auto-delete`. Rollback for a wrong delete: do not expire reflog; restore with `git branch <name> <sha>` from `git reflog`.

## Verification

- Extend `classify.test.ts`. Required cases: apply refusal of a stale name; unique `.context` not removed; dirty porcelain not removed; argv never contains `--force`; failed `git worktree remove` does not delete that branch; prunable missing-gitdir is not directory-deleted; current branch and integration branch survive `--apply`.
- `npx vitest run skills/git-cleanup/scripts/classify.test.ts` and `npm run guardrails:check`. This phase touches source, so the gate is blocking.
- Do not run `--apply` against this repo (`feat/git-cleanup-skill`) as part of landing the skill. Fixture repos only.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only. No `omp_execution` keyword and no `/goal set`.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces out-of-plan issues, do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
