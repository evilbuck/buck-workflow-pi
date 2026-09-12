---
name: fix-pr
description: >
  Resolve GitHub PR review feedback end to end: work on the real head branch in
  a git worktree, validate and fix findings, commit and push, then poll for an
  independent re-review and repeat until settled or the loop cap is reached.
  Ask the engineer only when validity is genuinely unclear. Use when the user
  wants PR review feedback actioned or points at a PR URL/number for fixes.
  OMP-first tooling; procedure is agent-agnostic. Load by skill name.
---

# fix-pr: Validate & Act on PR Review Comments

Ingest review feedback on a GitHub pull request, **validate** each comment
against current code, and **fix every valid finding by default** in a worktree
on the PR's real head branch. Commit, push, wait for independent re-review, and
repeat until the PR is settled or the configured loop cap is reached.

This is **not** a code reviewer and **not** a planner-only skill.

| Skill | Stops at | Mutates code? |
|---|---|---|
| `code-review` / `code-review-universal` | Posts a review | No |
| `b-pr-review-2-issues` | Plan artifact in `.context/` | No |
| **`fix-pr`** | Settled PR; filed issues only when explicitly requested | **Yes** |

## Surface — skill only (no prompt wrapper)

Shipped as **`skills/fix-pr/SKILL.md` only**. There is **no**
`prompts/fix-pr.md` and **no** `commands/fix-pr.md` symlink.

Invoke by loading the skill by name:

| Harness | Typical invoke |
|---|---|
| **OMP** (primary) | `/skill:fix-pr` or skill auto-load from description match |
| Pi | skill-by-name / description match |
| Claude Code / Cursor / Codex / OpenCode | load skill content; follow this doc |

Do **not** add a thin prompt wrapper "for slash discovery." Wrappers drift and
rarely carry the full procedure. If a slash alias is wanted later, it is a
separate registry change — not required for this skill to work.

## Harness posture: OMP-first, agent-agnostic

**Procedure is portable.** Every phase is expressible with `git` + `gh` + the
project test runner. Any coding agent that can run those can execute this skill.

**Tooling preference when multiple options exist:**

| Need | Preferred | Fallback |
|---|---|---|
| Read PR + comments | OMP `pr://N`, `pr://N?comments=1`, or GitHub tool | `gh pr view` + `gh api` |
| PR worktree | `gh pr checkout <N> --worktree <absolute-path>` | `git fetch` + `git worktree add` |
| Create issue | `gh issue create --body-file` | same |
| Commit | project `git-commit` skill if present | conventional `git commit` |
| Memory | `.context/memory/` per global AGENTS.md | same paths |

Rules:

- Detect harness from **runtime/session** signals (`omp` tools, `pr://`, etc.).
  Do **not** treat `package.json`'s `omp` field as "we are on OMP" — packages
  declare it regardless of who loads them.
- Never require OMP-only APIs to complete the job. If `pr://` is missing, use `gh`.
- Never mention or depend on a prompt-wrapper path.

## Orchestrate exploratory work

**OMP directive: `orchestrate`.** Keep raw PR payloads and broad code
exploration out of the mainline context. After Phase 1 anchors PR metadata,
dispatch one parallel `task` batch with two read-only collectors while the
mainline selects and synchronizes the worktree:

1. submitted reviews plus conversation comments;
2. inline comments plus diff and cited-code anchors.

After Phase 2 deduplicates the inventory, fan finding validation out by
independent file or tight root-cause group. Do not manufacture parallel slices.
If only one group remains, resume one collector through `hub send` or the
harness equivalent instead of launching a padded batch. A harness without task
subagents performs the same contracts inline.

Give each subagent only the PR coordinates, pinned `headRefOid`, its assigned
sources or finding IDs, and the worktree path when needed. Require compact JSON:

`{ "headOid": "...", "items": [{ "source": "...", "id": "...", "url": "...", "commit": "...", "pathLine": "...", "claim": "...", "verdict": "...", "evidence": "...", "blocker": "..." }] }`

Collectors omit `verdict` and `evidence`; validators use the Phase 3 verdict
taxonomy and cite only concise path/line, snippet, runtime, or URL evidence—never
raw payloads. Reject stale-OID, unknown-ID, unsupported, or incomplete results.
Raw PR responses stay inside child context; collectors return normalized records
only.

Subagents are read-only: no worktree/Git/GitHub mutation, final verification
gate, issue filing, or settlement decision. Claim validation may use a bounded
non-mutating reproduction; the mainline still owns the retained inventory,
final verdicts, edits, tests, staging, commits, pushes, polling, and settlement.

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | branch check, commit, push |
| `gh` | PR + comment fetch, issue create (auth required) |
| project test runner | verify fixes (narrowest suite that covers the change) |

## Inputs

```text
fix-pr
fix-pr <pr-number>
fix-pr <pr-url>
fix-pr <pr> --max-loop=<n>   # positive integer; default 10 fix/review loops
fix-pr <pr> --issues-only    # file issues instead of changing code
fix-pr <pr> --dry-run        # validate + inventory only; no local or remote mutation
```

If no PR is given, resolve the open PR for the current branch via `gh pr view`;
if none exists, ask for its URL or number. Reject a missing, zero, negative, or
non-integer `--max-loop` value. The flag applies only to fix mode.

## Completion contract

Default mode fixes every validated finding. Finding count, file count, and
estimated duration guide decomposition and verification; they do not route the
work to issues. Split a large pass into coherent commits when useful, then keep
going.

A default run is **settled** only when both conditions hold after the latest
push:

1. Every review thread is resolved or its finding is `already_done`, `invalid`,
   `nit`, or `out_of_scope` with current-HEAD evidence; no valid finding is open.
2. A different reviewer has submitted a review after the latest push that
   explicitly confirms the issues are resolved. The PR author does not submit
   this settlement review.

`--issues-only` is the explicit handoff mode: every valid finding must have a
non-duplicate issue before that run is complete. `--dry-run` stops after the
validated inventory. Nits remain optional and never become issues.

## Procedure

### Phase 1 — Identify PR + select its head-branch worktree

1. Resolve the PR, then fetch immutable branch and repository metadata before
   checkout:

   ```bash
   gh pr view <N> --repo <owner/repo> --json number,title,body,state,url,files,reviews,comments,headRefName,headRefOid,headRepository,headRepositoryOwner,isCrossRepository,baseRefName,baseRefOid
   ```

   The mutation target is `headRepository.nameWithOwner:headRefName`, not
   necessarily `origin`. Keep `headRefOid` as the validation anchor for this pass.

   Launch the two exploratory collector tasks now; keep them running while
   completing worktree selection and synchronization below.

2. For every non-dry-run, use a worktree whose checked-out local branch is
   exactly `headRefName`:

   - Run `git worktree list --porcelain` first. Git allows one worktree per
     branch. If `refs/heads/<headRefName>` is already listed, reuse that
     worktree instead of trying to create another.
   - Otherwise run `gh pr checkout <N> --repo <owner/repo> --worktree <absolute-path>`.
     Current `gh` uses the PR head branch name by default. Verify it; a checkout
     named `pr-<N>` or a detached checkout is not the mutation worktree.
   - If `gh pr checkout --worktree` is unavailable, fetch the PR head repository,
     create or reuse the local branch named exactly `headRefName`, then run
     `git worktree add <absolute-path> <headRefName>`.
   - Use the worktree's absolute path for every read, edit, test, commit, and push.
     Relative tool paths may otherwise resolve against the original session cwd.

   Require a clean worktree before synchronization. Fetch the PR head branch,
   fast-forward only, then re-fetch PR metadata and verify both:

   ```text
   git -C <worktree> branch --show-current == <headRefName>
   git -C <worktree> rev-parse HEAD       == <headRefOid>
   ```

   Divergence, a dirty reused worktree, or a non-fast-forward update is a blocker;
   preserve the work and report it. `--dry-run` creates or switches no worktree;
   read the pinned head through GitHub APIs instead.

3. Await and merge the full-feedback collector outputs; review bodies alone are insufficient:

   **OMP-preferred:**
   ```text
   read pr://<N>
   read pr://<N>?comments=1
   ```

   **Universal fallback:**
   ```bash
   gh pr view <N> --repo <owner/repo> --json number,title,body,state,url,files,reviews,comments,headRefName,headRefOid
   gh api repos/{owner}/{repo}/pulls/<N>/reviews
   gh api repos/{owner}/{repo}/pulls/<N>/comments
   gh api repos/{owner}/{repo}/issues/<N>/comments
   ```

   When `gh` + `jq` are present, the bundled fast path produces the initial
   ordered feed:

   ```bash
   bash skills/fix-pr/scripts/fetch-feedback.sh <owner/repo> <pr-number>
   ```

4. Read the full diff with `gh pr diff <N> --repo <owner/repo>`. For one
   file, use the worktree or the contents API:

   ```bash
   git -C <worktree> diff <baseRefOid>...<headRefOid> -- <path>
   gh api "repos/{owner}/{repo}/contents/<path>?ref=<headRefOid>"
   ```

   **Verified gotcha:** `gh pr diff` accepts at most one positional argument.
   `gh pr diff <N> -- <path>` is not a supported path filter; current `gh`
   exits with `accepts at most 1 arg(s)`. Do not use that form.

### Phase 2 — Inventory comments

Include:

- Submitted review bodies (human + bot) with concrete findings
- Inline / file review comments and threads
- Conversation comments that request changes

Sort feedback by `submittedAt` / `createdAt` and retain each review or
comment's immutable ID, URL, and commit SHA. A later review's silence does not
supersede an earlier open finding; only explicit resolution or current-HEAD
evidence does. A fix landed after the reviewed commit becomes `stale` /
`already_done` only after revalidation.

| Class | Rule |
|---|---|
| `resolved` threads | Skip unless user asked to re-check |
| `nit` / LGTM / pure style | Optional drive-by; no issue |
| `duplicate` | Across all reviews + inline + conversation — same claim or root cause → one work item, cite every source incl. earliest `submittedAt` |
| `stale` | Finding valid at an earlier review commit but superseded on HEAD → re-validate against HEAD; mark `already_done` with evidence, do not re-fix |
| `.context/**` only | Skip (session artifacts), **except** leaked secrets → actionable |
| Already fixed on HEAD | `already_done` + evidence; do not re-fix |
| Out of scope / drive-by redesign | `out_of_scope`, or ask if product-ambiguous |

Working table (retain it across loops):

`loop | source | id/url | commit | path:line | claim | submittedAt | verdict | disposition`

### Phase 3 — Validate each item against code

For every deduplicated pending item or tight root-cause group, confirm the
current `headRefOid`, then dispatch the validation frontier defined in
**Orchestrate exploratory work**. Each validator reads the cited code and
relevant callers/siblings at that anchor and returns a proposed verdict with
concise evidence. The mainline accepts or corrects that evidence, records the
final verdict, and applies this classification:

| Verdict | Meaning | Next |
|---|---|---|
| `valid` | Bug, missing guard, real inconsistency, clear improvement | Fix by default; issue only under `--issues-only` |
| `invalid` | Wrong, outdated, or contradicts deliberate design (with evidence) | Note why; do not fix |
| `already_done` | HEAD already addresses it | Cite proof |
| `unsure` | Needs product/steward call | **Ask the engineer** (below) |
| `nit` | Style-only | Optional / skip |

**Unsure protocol (short, batched):**

```text
Comment <N> (@author, path:line):
  Claim: <one sentence>
  Observed: <what code actually does>
  Why unclear: <missing product intent / two reasonable designs>
  Options: (A) …  (B) …
Valid? → fix / issue / skip per your call.
```

Do not block unrelated **valid** fixes on an open `unsure`.

**Root-cause bias:** one shared guard beats N call-site patches.

### Phase 4 — Choose the explicit disposition

Only the mainline chooses disposition. A subagent verdict is evidence, not
authorization to fix, file an issue, mutate state, or declare settlement.

Count every `valid` item still open; exclude `already_done`.

| Mode/state | Action |
|---|---|
| `--dry-run` | Write the validated inventory in Phase 6; no worktree, fix, issue, commit, push, or poll |
| `--issues-only` | Phase 5b; file every valid finding or tight root-cause group |
| Valid findings remain | Phase 5a; fix all of them regardless of size |
| Zero valid findings; settlement contract already met | Phase 6 with status `settled` |
| Zero valid findings; no qualifying post-push settlement review | Phase 5c using current HEAD and feedback IDs as the review anchor |

Large or risky work changes the decomposition, tests, and commit boundaries—not
the default disposition. Ask only for genuinely `unsure` product intent; keep
fixing independent valid findings while that answer is pending.

### Phase 5a — Fix, verify, stage, commit, push

1. Apply the smallest correct changes for **all** valid findings. Shared root
   cause means one fix, not repeated call-site patches.
2. Add only tests that protect observable regressions, then run the narrowest
   relevant tests and every project-required check for touched paths.
3. Stage the complete verified fix batch. Review the staged diff against the
   working table; every valid finding must map to a staged change or an explicit
   blocking decision.
4. Commit one coherent fix batch (multiple commits are acceptable only when the
   findings have independent themes):

   ```text
   fix(<scope>): address PR #<N> review (<short theme>)
   ```

   Use the repository's commit skill when present; otherwise use `git commit`.
5. Confirm the local branch is still exactly `headRefName`. Push explicitly
   to the PR head repository and branch:

   ```bash
   git -C <worktree> push -u <head-remote> HEAD:<headRefName>
   ```

   Use `origin` only when its push URL matches `headRepository.nameWithOwner`;
   for a fork PR, use or add a remote for the head repository. After pushing,
   re-fetch PR metadata and require `headRefOid` to equal local `HEAD`.
6. Record the pushed SHA, push time, and all feedback IDs already seen, then
   enter Phase 5c.

The push is a gate: verification is green, the index is staged, the commit
exists, and the target is `headRefName`. Use an ordinary push only; a rejection
is a blocker rather than permission to force-push.

### Phase 5b — Issues-only handoff

This path runs only under `--issues-only`. For each valid item or tight
root-cause group:

1. Search open issues for the same PR and theme.
2. Create one non-duplicate issue with `gh issue create --body-file …` containing
   the claim, current-HEAD evidence, paths, acceptance criteria, and PR/comment
   URLs. Confirm available labels before applying `ready-for-agent` or
   `needs-triage`, plus `bug` / `enhancement` as appropriate.
3. Record the issue URL in the working table. The path is complete only when
   every valid finding has a linked issue.

Do not edit, commit, push, or enter the review loop in issues-only mode. Nits do
not become issues.

### Phase 5c — Poll for review and repeat

A **fix/review loop** is one validated fix batch, verified commit and push, plus
the independent review outcome for that push. The default cap is 10 loops;
`--max-loop=<n>` replaces it with the supplied positive integer.

After each push, poll at these cumulative intervals:

```text
delay minutes:       2, 2, 2, 2, 2, 5, 5, 10
cumulative minutes:  2, 4, 6, 8, 10, 15, 20, 30
```

At each poll:

1. Fetch PR state, `headRefOid`, submitted reviews, inline comments, review
   thread resolution state, and conversation comments. Compare immutable IDs
   with the seen-ID set; counts alone are not evidence of new feedback.
2. Mark new IDs seen and revalidate every new finding against current HEAD.
   Feedback submitted after the push but pinned to an older commit is still
   evaluated against current HEAD.
3. If any new finding is `valid`:
   - when the current loop is below `max-loop`, synchronize the same
     `headRefName` worktree, start the next loop at Phase 2, then fix, verify,
     commit, push, and restart the 30-minute schedule;
   - when the current loop equals `max-loop`, stop with status
     `max_loops_reached` and report every unresolved finding. Do not start an
     unbudgeted loop or convert findings into issues implicitly.
4. If no valid finding remains and a different reviewer submitted a post-push
   review explicitly confirming that the issues are resolved, verify every
   thread is accounted for, then finish as `settled`.
5. If feedback arrived but does not settle the PR, continue with the remaining
   intervals. A review that introduces valid findings takes precedence over
   any contradictory resolved wording in that review.

When all eight polls complete without a qualifying settlement review, finish
with status `review_pending`, not `settled`. Record the last poll time and
resume from Phase 5c on the next invocation without duplicating fixes. The wait
schedule is 30 minutes total and never busy-loops.

### Phase 6 — Durable record + closeout

Always write `.context/memory/fix-pr-<pr>-YYYY-MM-DD.md` (or the active
subject's memory artifact) and update `.context/memory/index.md`. Record:

- PR URL, head repository, `headRefName`, and absolute worktree path
- one validation table retained across every loop
- per-loop pushed SHA, verification commands/results, review IDs, and poll times
- issue URLs in issues-only mode
- one terminal status: `settled`, `review_pending`, `max_loops_reached`,
  `issues_only`, or `dry_run`

Closeout format:

```text
PR #<N> — <title>
Status: <settled | review_pending | max_loops_reached | issues_only | dry_run>
Worktree: <absolute path | none for dry-run>
Head: <head-repository>:<headRefName>
Loops: <completed>/<max>
Pushes: <sha list | none>
Settlement review: <id/url | missing>

Validation:
| loop | id/url | claim | verdict | disposition |
|---|---|---|---|---|
| 1 | … | … | valid | fixed in <sha> |
| 1 | … | … | invalid | <reason> |
| 2 | … | … | already_done | <HEAD evidence> |

Verification:
- <command> → <result>

Unresolved: <none only when settled | exact findings or missing review>
```

## Behavior rules

- **Default means fix.** Resolve every valid finding; size changes decomposition,
  not disposition. Filing issues requires `--issues-only`.
- **Head-branch worktree.** Every mutation happens in the worktree whose local
  branch equals `headRefName`; push to that branch in the PR head repository.
- **`--dry-run` is no-mutate.** Use GitHub APIs for pinned code; create or
  switch no worktree and create no commits, pushes, comments, or issues.
- **Validate before mutating.** Re-read current HEAD; a resolved label or later
  review silence is not code-change evidence.
- **Settlement is independent.** The PR author never manufactures the review
  required to declare its own fixes resolved.
- **Bounded waiting.** Poll at `2,2,2,2,2,5,5,10` minutes and perform at most
  `max-loop` fix/review loops.
- **Ask only for `unsure`.** Valid, invalid, and already-done calls are the
  agent's responsibility; unresolved unsure items do not block independent fixes.
- **Verification gates the push.** Run project-required checks and push only a
  green fix batch.
- **Secrets stay secret.** Treat leaks as actionable without copying values into
  issues or memory.
- **Idempotent resume.** Keep feedback IDs and pushed SHAs; revalidate current
  HEAD, skip `already_done`, and create no duplicate issues.

## Error handling

| Situation | Response |
|---|---|
| `gh` missing / unauthenticated | Stop; install or authenticate `gh` |
| PR not found | Stop; ask for URL |
| Head branch already in another worktree | Reuse that absolute worktree path |
| Reused worktree dirty or branch diverged | Preserve it; stop with exact blocker |
| Checkout fails for another reason | Stop; report command and error |
| Tests fail after fix | Fix or revert; keep the remote unchanged |
| Push rejected | Stop; preserve commits; no force-push |
| PR closes or merges during polling | Stop mutation and report the remote state |
| No settlement review after 30 minutes | Finish `review_pending`; never claim settled |
| Review after loop cap has valid findings | Finish `max_loops_reached` with exact findings |
| Cannot create requested issues | Save draft bodies under `.context/` and report |

## Related skills

- `b-pr-review-2-issues` — plan-only ingestion (no code mutation)
- `b-issue-create` — richer AFK handoff from plan/spec context
- `b-iterate` — small follow-ups after fixes land
- `git-commit` — conventional commit helper when present
- `code-review-universal` — authoring reviews (opposite direction)
