---
name: git-clean-orphans
description: Inventory and remove stale local git artifacts — merged worktrees, worktrees whose remote is gone, and local branches whose remote is gone (whether or not merged into the default branch). Surfaces unmerged tips and reflog for user decision before destructive actions. Use when the user says "clean merged branches and worktrees", "tidy up stale branches", "remove orphan worktrees", or similar housekeeping. Read-only by default; destructive steps gated on user confirmation.
---

# git-clean-orphans: Stale Worktree & Branch Cleanup

Remove the local residue of finished work: worktrees whose remote is gone,
branches whose remote is gone. Tells the user what's unmerged before
destroying anything; never silently deletes work that has no remote anymore
without consent.

## What it cleans

| Category | Condition | Action |
|---|---|---|
| Worktree dir (registered) | remote of its branch is gone | `git worktree remove --force` + drop the branch ref |
| Worktree dir (foreign) | dir exists but is not in `git worktree list` (e.g. agent sandboxes) | **never touch** — owned by another process |
| Local branch | merged into `master` (or detected base) AND remote is gone | `git branch -d` |
| Local branch | unmerged AND remote is gone | **ask first** — print tip + reflog, await `git branch -D` confirmation |

Anything that still has a live remote ref is left alone.

## Procedure

### Step 1: Refresh

```bash
git fetch --prune origin
```

Surfaces the `[gone]` annotation on remote-tracked branches that were deleted
on the remote, which is the only safe way to know a branch is "orphan" rather
than "temporarily behind".

### Step 2: Inventory

Collect three lists in one read pass:

```bash
echo "=== worktrees (with linked branches) ==="
git worktree list --porcelain | awk '/^worktree/ {wt=$2} /^branch/ {print wt, $2}'

echo "=== local branches ==="
git branch -vv

echo "=== local branches merged into <base> ==="
git branch --merged <base>   # default base: master
```

**Base branch detection** — try in order, use the first that exists locally:
`main`, `master`, `develop`, `dev`. If none of these exist, stop and ask.

### Step 3: Classify worktrees

Each worktree is one of:

- **Current main worktree** (path matches `$PWD` or the only one whose branch
  is the current HEAD) — skip.
- **In-project registered worktree** (path starts with the repo's parent
  directory, listed in `git worktree list`) — candidate for removal.
- **Foreign / external** (path outside the repo, or `detached` with no
  branch, or with a `.git` *file* pointing elsewhere) — **always skip**.
  Examples observed: `~/.grok/worktrees/...`, `~/projects/worktrees/<other-agent>/...`.
  These are agent sandboxes; another process owns them.

**Detection rule for foreign worktrees:** if a worktree is `detached` AND its
directory's `.git` is a file (not a dir), it is not part of this repo's
worktree system even if it appears in `git worktree list`. Skip unconditionally.

**Dirty check** for in-project worktrees:

```bash
for wt in <in-project worktree paths>; do
  echo "--- $wt"
  git -C "$wt" status --short --branch
done
```

A worktree with uncommitted or untracked changes is "dirty". A clean
worktree is a free removal.

### Step 4: Classify local branches

For each non-current local branch:

- `git merge-base --is-ancestor <branch> <base>` — merged, can `-d`.
- Else — unmerged, must surface for decision.

Print for each unmerged branch:

```bash
echo "=== <branch> ==="
echo "-- tip --"
git log -1 --format='%h %s' <branch>
echo "-- reflog (last 5) --"
git reflog show <branch> 2>/dev/null | head -6
echo "-- ancestor of <base>? --"
git merge-base --is-ancestor <branch> <base> && echo "YES" || echo "NO"
```

This is the single source of truth for the "is this safe to delete?"
question. The user sees tip + reflog, decides per-branch.

### Step 5: User decision

Present a table with proposed actions. **STOP and wait for approval.** No
matter how obvious the answer looks, do not destroy a branch that has no
remote anymore without an explicit `yes` per branch (or `yes, all`).

Question shape:

```
In-project worktrees (dirty = has uncommitted changes):
  pp.environment-seeds.wt  [chore/environment-secrets]  remote gone  DIRTY
  pp.photo-review-filters.wt  [feat/photo-review-filters]  remote gone  CLEAN

Local branches (remote gone):
  feat/homepage-images     merged into master
  sentry-install           merged into master
  feat/ux-flow-misc        NOT in master
  design/cleanup-uploader  NOT in master
  ...

Unmerged tips + reflog (below). Delete which?

A) Drop the worktrees clean (force, discard dirty state)
B) Stash dirty state in each worktree, then remove
C) Commit dirty state onto each branch, then remove
D) Stop — I'll back up manually

For unmerged branches:
A) Delete all of them (reflog keeps tips ~30 days)
B) Keep all of them
C) Per-branch list — I'll tell you which

Foreign worktree dirs (detached, not in this repo's worktree system):
  ~/.grok/worktrees/.../returning-guest
  ~/projects/worktrees/.../deft-beacon/...

A) Leave alone (recommended)
B) Delete the directories (only if no agent is using them)
```

The defaults that work in 95% of cases: **A, A, A** — but always ask,
because unmerged branch tips can hold work the user has not yet pushed.

### Step 6: Execute (in order)

**Why this order matters:** removing a worktree dir first lets `git
worktree remove` prune the branch-ref linkage; the branch can then be
`-d`'d (merged) or `-D`'d (unmerged) independently.

```bash
# 1. Remove in-project worktrees (force, since the user approved discarding dirty state)
for wt in <in-project worktree dirs>; do
  git worktree remove --force "$wt"
done
git worktree prune

# 2. Delete merged branches (safe: -d refuses on unmerged)
git branch -d <merged branches>

# 3. Delete unmerged branches (force: -D skips the merge check)
git branch -D <unmerged branches the user approved>

# 4. Verify
git branch -vv
git worktree list --porcelain
ls -d <expected worktree dirs> 2>/dev/null || echo "(none)"
```

`git worktree remove` on a registered worktree drops the directory but
leaves the branch ref. After step 1, branches that were linked to a
removed worktree are now "regular" local branches and fall into steps 2
or 3.

**Watch out:** a branch whose tip was a merge base for one of the deleted
worktrees may now be "not fully merged" and need `-D` instead of `-d`.
If `git branch -d` errors with `not fully merged`, fall back to `-D`
for that branch and note it in the report.

### Step 7: Report

```
Removed (in-project):
  N worktree dirs: <list>
  M local branches: <list>
  K force-deleted branch refs: <list>

State: <remaining branch count> local branches, <remaining worktree count> worktrees.

Reflog retains the <K> force-deleted tips for ~30 days (default
gc.pruneExpire=never extends to 90). Recover any of them with
`git reflog | grep <sha-prefix>`. Want them gc'd now?
  A) Leave reflog alone (default — ~30 days)
  B) git reflog expire --expire=now --all && git gc (gone now)
```

## Behavior Rules

- **Default base is `master`**. Try `main` next only if `master` does not
  exist. Never guess; if no conventional base exists, ask.
- **Foreign worktrees are never touched.** A worktree with `detached`
  HEAD and a `.git` file in its directory is owned by some other process.
  Even if the user has cleaned up the in-project residue, leave the
  foreign dirs alone unless they explicitly say "and remove
  ~/.grok/.../returning-guest".
- **Unmerged branches require per-branch consent.** `git branch -D` is
  silent and fast; one wrong key and a day of work is gone. The reflog
  is a safety net, not a substitute for asking.
- **Dirty worktrees are surfaced, not silently discarded.** The user
  always sees `M` / `??` markers and picks the disposition. Default
  should be the laziest option ("drop clean"), but a 5-second "is this
  really what you want?" beats a 5-hour "where did my edits go?".
- **Reflog expires by default after ~30 days.** The skill does not run
  `git gc` on completion unless the user opts in. Most teams want
  reflog to stick around for a session or two; that is fine.
- **No `git push --prune` and no remote branch deletion.** This skill
  is strictly local. Cleaning up remote branches is a separate concern
  (often owned by the PR-merge workflow or repo settings).
- **Idempotent.** Re-running after a clean state prints "nothing to do"
  and exits.

## Out of Scope

- Cleaning stashes, reflog, or `.git/` objects generally — `git gc` /
  `git reflog expire` are surfaced as an opt-in, not part of the default
  pass.
- Deleting remote branches.
- Modifying worktree layout (moving, renaming, re-listing).
- Touching foreign / external worktree directories (agent sandboxes,
  CI checkouts, IDE workspaces).

## Required User Input

The skill will block on user input at Step 5. There is no `--force`
flag that bypasses it. If you want a one-shot destructive run, do it
yourself with `git branch -D <list> && git worktree remove --force
<list>` — the skill is for the case where you're not sure what's safe.
