---
name: b-eval-upstream-prs
description: >
  Evaluate open pull requests from an upstream repository (e.g. a fork's
  parent or another vendor project). Triage each PR on Importance / Friction
  / Risk, run an isolated per-PR validation pass (worktree + build + tests +
  coverage + complexity + diff-scoped lint), and produce a written evaluation
  plan with bucket rankings and a conflict-avoiding merge order. Local-only —
  no remote comments, no upstream pushes. Use when a fork
  maintainer says "evaluate the upstream PRs", "triage the open PRs",
  "what should we pull from upstream", or similar.
---

# b-eval-upstream-prs: Upstream PR Evaluation

A **local evaluation skill** for fork maintainers (or any agent weighing
in on a vendor's open PR queue). It does NOT adopt, merge, push, comment, or
otherwise mutate remote state. It writes only to `.context/plans/` (the
evaluation plan) and per-PR validation worktrees
(`../worktrees/<owner>-<repo>-pr-<n>`).

## When to use

- A fork's upstream has open PRs and you want a structured recommendation.
- The user wants a per-PR verdict + a merge order that minimizes conflicts.
- The user wants validation done locally — builds, tests, coverage, complexity,
  diff-scoped lint — on each candidate before any decision.
- The user is willing to skip the validation step for trivial doc nits.

## When NOT to use

- Adopting a PR you have already evaluated → use `b-build` / `b-iterate` to
  land it on a topic branch.
- Commenting on / approving remote PRs → out of scope here.
- Reviewing *your own* PR or PR comments → use `b-review` / `fix-pr`.
- Code-reviewing a single PR in depth → use `code-review` / `code-review-universal`.

## Posture: local-only

**Hard rule.** This skill writes only to:

- The local checkout's `.context/plans/` (the evaluation plan).
- Per-PR validation worktrees (created with `git worktree add --detach ../worktrees/<owner>-<repo>-pr-<n>`).
- `gh` reads via `pr://` URLs, `issue://`, or `gh pr view` / `gh pr list`.

It MUST NOT:

- Comment on remote PRs.
- Approve, merge, or close remote PRs.
- Push to upstream.
- Open review tickets or new remote issues.

If the user wants any of the above after evaluation, hand off to `b-pr`,
`fix-pr`, or `b-iterate` — those are separate skills.

## Inputs

| Input | Example | Behavior |
|---|---|---|
| Repo | `FelixKratz/JankyBorders` | Selected GitHub `owner/repo`. Default: current fork's parent |
| `git_compare_branch` | `origin/main` | What to diff PRs against (for "what would this PR change *in our fork*") |
| Validation surface | `make test`, `make coverage`, `./scripts/lint`, `uvx lizard==1.24.0` | Pulled from project's `guardrails.json` or AGENTS-managed block |
| Output path | `.context/plans/upstream-pr-evaluation.md` | Default; user may override |

If the user invokes interactively with no arguments, ask which upstream repo to
scan, where to write the plan, and whether validation should run (build/tests
take time).

## Methodology — Importance / Friction / Risk → bucket

Rate each PR on three axes, then bucket:

| Axis | Question |
|---|---|
| **Importance (I)** | Does the PR fix a real bug, security issue, perf regression, or unlock blocked work? How much does the fork's users benefit? |
| **Friction (F)** | How painful is the merge — base drift, conflicts with other PRs, behavior changes that diverge from the fork's direction, missing tests. |
| **Risk (R)** | Does the change break the fork's ABI/runtime, conflict with active guardrails (coverage baseline, complexity ceiling, patch gate), or add external dependencies? |

**Buckets:**

- **A — Validate & adopt.** High I, low F, low R. Run the full validation pass.
- **B — Cherry-pick / monitor.** High I, medium F or R. Validation is worth the work.
- **C — Defer.** Medium I, any F. Worth revisiting when context allows.
- **D — Skip / decline.** Low I, or contrarian to the fork's direction, or already addressed.

## Procedure

### Phase 1 — Inventory

1. Resolve the target repository to a fetch URL. Never assume a git remote
   named `upstream`.

   - Repo from `$ARGUMENTS` (`owner/repo`), else the current fork's parent:
     `gh repo view --json parent --jq '.parent.owner.login + "/" + .parent.name'`
   - `FETCH_URL`: an existing local remote whose URL refers to that
     `owner/repo` (ssh or https), **or** `https://github.com/<owner>/<repo>.git`
     if none matches. Do not `git remote add` / `git remote set-url` unless
     the user asked.
   - Inventory (`gh --repo`) and validation (`git fetch`) both use this same
     `UPSTREAM_REPO` / `FETCH_URL`. A fork with no `upstream` remote, or an
     explicit vendor repo other than the configured upstream, must still
     validate.

2. List open PRs against that repo:
   ```sh
   gh pr list --repo "$UPSTREAM_REPO" --state open --limit 200 \
     --json number,title,author,createdAt,updatedAt,isDraft,labels,
            baseRefName,headRefName,additions,deletions,changedFiles,
            comments,reviewDecision,mergeable,url \
     > /tmp/upstream_prs.json
   ```
3. Capture recent closed/merged for context:
   ```sh
   gh pr list --repo "$UPSTREAM_REPO" --state closed --limit 100 \
     --json number,title,author,createdAt,updatedAt,mergedAt,state \
     > /tmp/upstream_closed_prs.json
   ```
4. Identify the fork's `git_compare_branch` (default: `origin/main`); record it
   for the diff step.

### Phase 2 — Triage table

Render a compact table with one row per PR:

```
| # | Title | Author | adds/dels | files | merge | I/F/R | Bucket |
```

Keep it short. The plan file gets this verbatim.

### Phase 3 — Per-PR validation (A and B buckets only)

Each PR gets its own worktree so validation can't pollute the working tree.

```sh
# UPSTREAM_REPO and FETCH_URL from Phase 1. Never a hardcoded remote named `upstream`.
# Namespace ref + worktree by repo so PR #<n> from two vendors cannot collide.
# --force so an upstream force-push replaces a stale ref; --detach so no
# persistent local branch is left behind.
REF=refs/eval/<owner>/<repo>/pr-<n>
WT=../worktrees/<owner>-<repo>-pr-<n>

git fetch --force "$FETCH_URL" "refs/pull/<n>/head:$REF"
mkdir -p ../worktrees
git worktree remove --force "$WT" 2>/dev/null || true
git worktree add --detach "$WT" "$REF"
```

**Restore the fork's validation plumbing** into each worktree. The upstream
PR branch usually lacks the fork's test/lint setup, so copy:

```sh
# From inside ../worktrees/<owner>-<repo>-pr-<n>:
git show origin/<fork-base>:makefile             > makefile
git show origin/<fork-base>:test/test_main.c     > test/test_main.c
for f in test/unity/unity.c test/unity/unity.h test/unity/unity_internals.h; do
  git show "origin/<fork-base>:$f" > "$f"
done
mkdir -p scripts
git show origin/<fork-base>:scripts/lint > scripts/lint 2>/dev/null
chmod +x scripts/lint 2>/dev/null
```

This step is critical: PR branches almost never carry the fork's test
plumbing. Skipping it makes `make test` look broken when the project isn't.

**Run the validation battery** (skip macOS-only steps if not on macOS):

| Step | Command | Pass criterion |
|---|---|---|
| Build | `make -j` | Exits 0; warnings allowed unless `-Werror` |
| Unit tests | `make test` | All tests PASS |
| Coverage | `make coverage` | Compare line coverage to `guardrails.json` `ratchet.baseline_coverage` |
| Complexity | `uvx lizard==<pinned> -C <max> -w --csv src` | Count functions with CCN >= max; record delta vs baseline |
| Diff-scoped lint | `clang --analyze -std=c99 -Wall -Wextra <changed files>` | 0 new analyzer errors on touched files |

**Record per-PR results** in the plan file:

```
#### PR #<n> — <title>
- Build: clean / failures
- Test: N/M PASS
- Coverage: X% (ΔY vs baseline)
- Complexity: N hotspots (Δ vs baseline)
- Lint: clean / N new errors
- Verdict: adopt / defer / decline
- Integration cost: <rewrite X, add test Y, etc.>
- Recommendation: <topic branch name + verification step>
```

**Gotchas to flag explicitly:**

- **Version-string regressions inside PRs.** Some upstream PRs accidentally
  revert version bumps (e.g. MINOR 9 → 8). Always check `src/main.c` or
  equivalent for the version constants after diffing.
- **CONFLICTING is often a false positive.** `gh` reports CONFLICTING when the
  PR base drifted. Locally you can usually fetch the PR head via `$FETCH_URL`
  (Phase 3) and `git worktree add` cleanly. Don't drop the PR without trying locally.
- **Test API drift.** PRs that change struct fields (e.g. moving `blacklist`
  out of `struct settings` into globals) break the fork's `test_main.c`. The
  PR is fine; the fork's test needs a follow-up rewrite. Track this as
  integration cost, not as a reason to decline.
- **Coverage drift is acceptable for refactors.** A PR that adds new code
  paths to `parse.c` may drop measured line coverage even when none of the
  existing tests lose coverage. Reconcile via `ratchet_update.new_baseline_coverage`
  on explicit user approval, or by adding a targeted test for the new paths.

### Phase 4 — Merge-order plan

After validation, examine the **overlap matrix** (which files each PR
touches). Two PRs that touch the same struct definition or hot file rarely
merge cleanly together. Choose an order that:

1. **Removes structural fields first** (e.g. PR that deletes fields wins over
   PRs that read those fields).
2. **Adds new code last** (large rewrites at the end reduce churn).
3. **Cherry-picks tiny fixes first** (pthread_mutex_destroy, etc.) so each
   step is independently buildable.

Render the order as a one-line list at the top of the plan:

```
Merge order recommendation: #191 -> #195 -> #205 -> #206 -> #204 -> #208
```

### Phase 5 — Write the plan

**Canonical output**: `.context/plans/upstream-pr-evaluation.md` (or
`.context/<subject>/plan-upstream-pr-evaluation.md` if you are inside an
active subject folder).

Required sections:

1. **Header** — date, upstream repo, fork branch, source commands, raw data files.
2. **Methodology** — I/F/R + bucket definitions (copy from this skill).
3. **Inventory table** — verbatim from Phase 2.
4. **Validation results** — per-PR block from Phase 3.
5. **Conflict matrix** — file overlap between PRs.
6. **Merge order** — from Phase 4.
7. **Decisions table** — final adopt/defer/decline with rationale.
8. **Worktree cleanup note** — keep or `git worktree remove`.

Use `status: draft` in the plan's frontmatter if your project convention uses
three-state status (draft/active/completed).

### Phase 6 — Stop

This skill ends at the plan. It MUST NOT comment, approve, merge, close, or
push — even if the user asks mid-session. Hand off:

- "Adopt PR #N" → load `b-iterate` (small) or `b-build` (medium) on a topic branch.
- "Open a PR with these upstream PRs bundled" → load `b-pr`.
- "Comment / approve / request changes on a remote PR" → out of scope here.
  Load `code-review` / `code-review-universal` (upstream) or `fix-pr` (this
  fork) as a **separate** skill. Never `gh pr comment` / `gh pr review` from
  this one.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `make test: No rule to make target 'test'` | PR branch lacks the fork's test plumbing | Restore `makefile`, `test/test_main.c`, `test/unity/*` from fork base (see Phase 3) |
| `test/unity/unity.c: No such file` | Copy loop interrupted | Re-run the per-file `git show` for each unity file |
| `make coverage: error: no member named 'X' in struct` | PR changed struct shape; fork's test references old shape | Record as integration cost; don't reject the PR |
| `lizard: command not found` | `lizard` not on PATH | `uvx lizard==<pinned>` per project AGENTS-managed guardrails block |
| CONFLICTING marker from `gh pr list` | upstream base drift | Phase 3 fetch via `$FETCH_URL` then `git worktree add`; usually clean |
| Coverage drops 2-3% with new code paths | Refactor adds uncovered lines | Either ratchet baseline (explicit user approval) or add a targeted test |
| Pre-existing analyzer errors in `src/windows.c:374` etc. | Deferred debt documented in `.context/backlog/items/` | Diff-scoped lint ignores them; whole-tree lint lists them — out of scope for this skill |

## Validation surface discovery

Before running anything, locate the project's validation surface from:

1. **`guardrails.json`** at repo root — authoritative for v2 contracts.
   ```sh
   jq '.ecosystems[] | {name, test_runner, coverage_tool, lint_cmd, complexity_cmd}' guardrails.json
   ```
2. **AGENTS.md** managed guardrails block (managed by `b-init-guardrails`).
3. **`scripts/lint`** and **`scripts/check-complexity`** if present.
4. **Makefile / makefile** for `test` and `coverage` targets.

If the project has none of these, surface the project's README testing block
as unverified suggestions and warn the user that no deterministic check
contract exists.

## Related skills

| Skill | Relationship |
|---|---|
| `b-pr` | Opens a PR from this fork's branches (write side; this skill is local-only) |
| `b-pr-review-2-issues` | Ingests PR *review comments* into a plan; this skill evaluates the PR itself |
| `b-build` / `b-iterate` | Implements the work this skill recommends |
| `b-review` | Reviews changes after they're built |
| `b-plan` | Generic planning; this skill is a specialized form for upstream PR triage |
| `b-pr-improved` | Open + push PRs from this fork (post-adoption) |
| `fix-pr` | Validates and acts on review feedback (write side) |

## Subject folder resolution

Follow `skills/_shared/subject-resolution.md`. If a subject folder is active
and named for this evaluation (e.g. `2026-09-06.upstream-pr-evaluation/`),
write the plan to that subject instead of the bare plans dir.
