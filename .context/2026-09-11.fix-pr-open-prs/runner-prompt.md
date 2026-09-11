# fix-pr loop — open PRs, oldest first

You are `pr-fixer` in repo `evilbuck/buck-workflow-pi` at
`/home/buckleyrobinson/projects/development_tools/buck-workflow-pi`.

Load and follow `skill://fix-pr` (also `skills/fix-pr/SKILL.md`). Do **not**
plan-only. Validate review comments against HEAD, then fix+commit+push or file
issues per the size gate.

## PRs (oldest first — this is the loop order)

1. https://github.com/evilbuck/buck-workflow-pi/pull/17
2. https://github.com/evilbuck/buck-workflow-pi/pull/19
3. https://github.com/evilbuck/buck-workflow-pi/pull/20
4. https://github.com/evilbuck/buck-workflow-pi/pull/21

Re-fetch `gh pr list --state open` before starting in case the set changed.
Process remaining open PRs oldest-created first.


## Worktrees

For **each** PR, use a dedicated git worktree — do not checkout on this
session's main working tree.

Preferred: GitHub `pr_checkout` / `gh pr checkout` into a worktree (OMP
`github pr_checkout` does this). Fallback:

```bash
git fetch origin pull/<N>/head:pr-<N>
git worktree add ../worktrees/buck-workflow-pi-pr-<N> pr-<N>
```

Work in the worktree's **absolute** path (relative Edit/Read can resolve to
the session cwd, not the worktree).

## Push workaround (required)

OMP `github pr_checkout` often creates local branch `pr-<N>` whose upstream
does **not** map to the PR head. After a fix:

```bash
git push origin HEAD:<headRefName>
```

where `headRefName` is the PR's real branch (`gh pr view <N> --json headRefName`).
If a stray `origin/pr-<N>` was created, delete it (`git push origin --delete pr-<N>`).
**No force-push** unless this prompt is later updated to order it.

## Review settlement gate (required — do not skip)

A PR is **not done** after the first fix-pr pass. Between every fix and the
next, wait long enough for new reviews to land. Leave a PR only when **all**
of these are true:

1. Every review thread is GitHub-`resolved` or the finding is `already_done` /
   `invalid` / `nit` with evidence. No open valid findings.
2. After the latest push, CI checks have completed (`gh pr checks <N> --watch`).
3. A **settlement window** has elapsed **after CI** with no new review
   comments: **15 minutes**. Re-fetch reviews at the end of the window. If
   anything new arrived, run fix-pr again, then repeat from (2).
4. A **last review** exists on the PR whose body states that issues have been
   resolved (accept: "issues have been resolved", "issues are resolved",
   "all issues resolved"). This must be a submitted GitHub review, not only
   our memory file. Do **not** write that review yourself as the PR author.
   Keep polling the 15-minute window until that review appears.

Do not start PR N+1 until PR N meets (1)–(4). Poll; do not busy-loop.

## Constraints

- One PR at a time.
- Do not expand into unrelated refactors.
- Do not close the Herdr pane.
- `--dry-run` is NOT set — mutate when the size gate says fix.
- If a PR is already merged/closed when you reach it, skip and record that.
- Write `.context/memory/fix-pr-<N>-2026-09-11.md` and update
  `.context/memory/index.md` per fix-pr Phase 6 **in that PR's worktree** if
  the branch owns `.context/`; also append one line to
  `/home/buckleyrobinson/projects/development_tools/buck-workflow-pi/.context/2026-09-11.fix-pr-open-prs/results.md`
  (create it) after each **settlement cycle** (not only the first pass).

## After the last PR

Reply with a closeout table: PR number, title, verdict summary, pushed yes/no,
issue URLs, URL of the resolving review. Then stop and wait.
