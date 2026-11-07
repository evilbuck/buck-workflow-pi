---
status: completed
phase: 1
order: 1
plan: plan-git-cleanup.md
phases_overview: plan-git-cleanup-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Classify every local branch and registered worktree as skip, auto-delete, or ask, and delete nothing."
files:
  - skills/git-cleanup/scripts/classify.ts
  - skills/git-cleanup/scripts/classify.test.ts
  - skills/git-cleanup/SKILL.md
from_plan_steps: [1, 2, 3, 4, 5, 6]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] `classify.ts` prints one JSON document on stdout and exits 0. It has no delete path. `--apply` is a usage error (non-zero, no git delete)."
  - "[x] Base ref is `refs/remotes/origin/HEAD`, otherwise local `master`, otherwise local `main`. If none exist, the script stops and does not guess a base."
  - "[x] The script runs `git fetch --prune origin` first via `execFile` argv. Fetch failure sets every item `remote` to `unknown` and does not treat any branch as remote-gone."
  - "[x] Containment matches plan A-2: `git merge-tree --write-tree -z` yields a tree oid, every conflict path is under `.context/`, and `git diff --quiet <base> <oid> -- . ':(exclude).context'`. An unrecognized `-z` record fails closed (not contained). Do not scrape `Auto-merging` prose."
  - "[x] `git cherry` `+` and `-` counts are evidence fields only. A `+` line does not by itself keep a branch and does not by itself authorize `auto-delete`."
  - "[x] Two-commit squash whose code is contained, with an empty `.context` diff and a clean worktree, is `auto-delete`. The same fixture with a differing `.context` file is `finished` and `ask`."
  - "[x] A merge-tree conflict outside `.context` (fixture: `src/app.ts`) is not `auto-delete`. A `.context`-only conflict that still has an empty code diff is not `auto-delete`."
  - "[x] Any non-ignored `git status --porcelain` line in a worktree blocks `auto-delete`, including an untracked file. Ignored files stay hidden."
  - "[x] Current checkout, the integration branch, and the main worktree are `skip`."
  - "[x] A worktree outside the main repo parent, registered to this common git dir, is classified. A prunable entry whose gitdir is missing is `ask` and is not directory-deleted."
  - "[x] Every `ask` row has `state` of `planning`, `building`, or `finished`, and `description_source` of `pr_title`, `plan_h1`, `commit_subject`, or `branch_name`. Missing or failing `gh` is `pr: null`, not 'no PR'."
  - "[x] The script never runs `git branch -D`, `git worktree remove`, `git reflog expire`, `git gc`, or a network write other than the fetch."
completed_at: 2026-10-27
completed_by: null
sql_memory_ids:
  - "01a1801f-b353-74b6-9e06-8686930e36c8"
---

# Phase 1: Classifier JSON

## Context

Parent user goal: a developer can delete local worktrees and branches whose code is already in the integration branch — including after a squash, rebase, or rewritten history — and then decide, from a one-line description and a planning / building / finished label, what to do with everything that is not proven landed.

This phase builds only the proof. Wrong JSON is the root of a later false delete, so the classifier fails closed and has no delete flag. `--apply` is Phase 2. The redirect, wrappers, and public docs are Phase 3.

Iteration scope adjustment (2026-10-26): author the complete canonical `SKILL.md` in Phase 1 to satisfy the mandatory direct-root-skill catalog invariant. It documents the accepted final workflow and stops on an unavailable apply prerequisite. Phase 2 still implements apply; Phase 3 still owns wrappers, redirect, public documentation, and verification of the procedure against the landed apply interface. No placeholder skill, catalog exemption, or enforcement change is used.

Parent assumptions A-1 through A-6 are validated. This phase implements them; it does not re-open them. No deferred assumption is owned here.

## Implementation Details

New Node-compatible script `skills/git-cleanup/scripts/classify.ts`. `promisify(execFile)` from `node:child_process` — `node:child_process/promises` does not exist on this machine. Argv only. No shell.

1. Resolve the base per A-1. Stop if none of the three refs exist.
2. `git fetch --prune origin`. On failure, continue the inventory with `remote: "unknown"` for every item. Do not infer remote-gone from a failed fetch.
3. Inventory `git worktree list --porcelain` and `git for-each-ref refs/heads`. Scope is every worktree registered to this repo's common git dir, whatever its path (A-6). A branch with no worktree is still an item.
4. Containment per A-2. Read the tree oid and conflict paths from the documented `git merge-tree --write-tree -z` records for the installed git (plan fixture used 2.56.0). Fail closed on an unrecognized record. Record `git cherry` `+`/`-` counts as evidence only.
5. Unique `.context`: `git diff --quiet <base> <branch> -- .context` is false → `unique_context: true`, and name the paths. Those items are not `auto-delete` (A-3).
6. Dirty: in a worktree, any `git status --porcelain` line blocks `auto-delete`. A prunable worktree whose gitdir is missing cannot be status-checked; disposition `ask`. Do not run `git worktree prune` in this phase.
7. State, from the branch tip (worktree if present, otherwise `git show <branch>:.context`):
   - `finished` when code is contained, or the subject is `completed` and there is no unique code outside `.context`.
   - `planning` when there is no unique code outside `.context`, the worktree is clean, and the tip has a draft subject, a draft plan, or only research / brainstorm / plan artifacts.
   - `building` otherwise (unique code, dirty source, open PR, active subject with an implementation diff).
   - Description, in order: PR title, plan H1, tip commit subject, branch name. Record `description_source`. Do not invent a summary.
8. Disposition:
   - `skip`: current checkout, integration branch, main worktree.
   - `auto-delete`: `finished`, code contained, `unique_context` false, not dirty, not skip. Fetch status does not authorize or block this.
   - `ask`: every other registered branch or worktree.

Stdout is one JSON object:

```json
{
  "base": { "ref": "refs/remotes/origin/HEAD", "sha": "<oid>" },
  "fetch": { "ok": true },
  "items": [
    {
      "kind": "worktree",
      "name": "feat/example",
      "path": "/abs/or/null",
      "tip": "<oid>",
      "disposition": "ask",
      "state": "building",
      "description": "<from the source order>",
      "description_source": "commit_subject",
      "unique_context": false,
      "unique_context_paths": [],
      "dirty": false,
      "dirty_paths": [],
      "contained": false,
      "conflict_paths": [],
      "cherry": { "plus": 0, "minus": 0 },
      "remote": "live",
      "pr": null,
      "prunable": false,
      "skip_reason": null
    }
  ]
}
```

`remote` is `live`, `gone`, `unknown`, or null when the branch has no upstream. `pr` is `{ "state": "<gh>", "title": "<title>" }` or null. `skip_reason` is `current`, `integration`, `main-worktree`, or null. `kind` is `worktree` or `branch`. A branch that also has a worktree appears once, as `worktree`.

Tests live in `skills/git-cleanup/scripts/classify.test.ts`. Vitest already includes `skills/**/scripts/**/*.test.ts`. Use vitest, not `bun:test`. Build temp repos. Do not add an apply-refusal test here; that is Phase 2.

## Risks

- A containment parser that treats a source conflict or a non-empty code diff as contained. Mitigation: fail closed unless A-2 passes; fixture for `src/app.ts` conflict and for a unique commit. Rollback: this phase deletes nothing.
- Scraping `Auto-merging` prose instead of `-z` records, so a locale or git wording change flips disposition. Mitigation: unrecognized records are not contained.
- Treating `git cherry` `+` as "not landed" and hiding a real squash, or treating `-` as permission to delete. Mitigation: cherry counts are evidence fields; the squash fixture must be `auto-delete` only because containment passed.

## Verification

- `npx vitest run skills/git-cleanup/scripts/classify.test.ts` covers: ancestor; single-commit squash; two-commit squash (`cherry` is `+`); cherry-pick equivalent; unique commit; `src/` conflict; `.context`-only conflict with code contained; unique `.context` file; dirty porcelain; untracked file; current branch; prunable missing gitdir.
- `npm run guardrails:check` at the checkpoint. This phase touches source, so the gate is blocking.
- Smoke, in this repo, no `--apply`: `bun skills/git-cleanup/scripts/classify.ts`. Expect `feat/git-cleanup-skill` to be `skip`. Do not point the script at a delete.

## Retained findings

One in-plan safety defect previously retained below the waterline is now fixed and tracked as completed in `.context/backlog/archive/2026-10/phase-1-refname-collision.md`:

- A tag name colliding with a branch no longer affects identity. Branch inventory reads full `%(refname)` and removes only the `refs/heads/` prefix; regression tests verify one integration branch row with `skip_reason: integration`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only. No `omp_execution` keyword and no `/goal set`.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces out-of-plan issues, do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
