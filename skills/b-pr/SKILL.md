---
name: b-pr
description: Create a GitHub pull request from the current feature branch. Resolves and caches the base branch, auto-rebases against it (resolving conflicts in-line), generates a description from the implementation diff — using `.context/**` artifacts only as the research that informed the work (never as part of it) — optionally polishes via a parallel subagent, then creates the PR via `gh` with no confirmation gate.
---

# b-pr: Pull Request Agent

Create a GitHub pull request from the current feature branch with a well-crafted description built from the **implementation** diff (code, config, docs). `.context/**` artifacts (plans, specs, brainstorms, research) are treated strictly as the research and planning that **informed** the work — referenced as background, never listed as part of the implementation.

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | branch detection, diff, rebase verification |
| `gh` | PR creation, auth check |
| `bun` | runs the preflight script (no compile, native TS) |


## Invocation

```
/b-pr              # resolve base (cached or detect), rebase, gather, create — no confirm gate
/b-pr --base main  # override the cached base (re-caches 'main')
/b-pr --no-cache   # ignore the cached base; re-prompt for the target
/b-pr --draft      # create as draft PR
/b-pr --dry-run    # show what would be created; does NOT rebase or create
```

## Procedure

### Phase 1: Resolve the Base Branch

Run the preflight with no `--base`. It resolves the base in priority order: `--base` flag → **cached base** → candidate detection.

```bash
bun skills/b-pr/scripts/pr-preflight.ts
```

Branch on the output's `base_source`:

- **`"cache"`** (output has `chosen_base`): a prior run remembered the pick in `.git/b-pr-base`. **Use it directly — do not re-ask.** This single run validated, rebased, and gathered — interpret its exit code per Phase 2 (on exit 0, proceed to Phase 3).
- **`"candidates"`** (output has only `base_candidates`, no `chosen_base`): cache miss. Present the candidates and ask the user **once**:

  ```
  Current branch: feature/my-thing

  Detected base branches:
  1. main (origin/main)

  Which is the target base for this PR?
  ```

  The user may type a branch not in the list. Re-run with their pick — the script validates it and **writes it to the cache** on success, so later runs skip this prompt:

  ```bash
  bun skills/b-pr/scripts/pr-preflight.ts --base <pick>
  ```

  Then interpret that run's exit code per Phase 2.

**The cache is the source of truth for "don't re-ask".** Override: `--base <name>` (re-caches) or `--no-cache` (re-prompt once). Clear it: `rm $(git rev-parse --git-dir)/b-pr-base`.

### Phase 2: Rebase + Gather

Whenever the script runs with a resolved base (cache hit, or a `--base` re-run), it fetches origin (`git fetch --prune`) and — if the branch is behind the base — **rebases automatically** (`git rebase origin/<base>`). Act on the exit code:

| Exit | Meaning | Action |
|---|---|---|
| 0 | up to date, or clean rebase done | parse JSON, proceed to Phase 3 |
| 1 | error (not a repo, gh unauth'd, rebase already in progress, dirty tree) | surface the message, stop |
| 2 | behind, but `--dry-run` was passed | report, stop |
| 3 | **rebase conflict** | resolve (below), then re-run this phase |

**Exit 3 — conflict resolution (you are the model):** the JSON carries `rebase_conflict: true` and `conflicted_files[]`.

1. For each path in `conflicted_files[]`, read the file, reconcile both sides, strip the `<<<<<<<` / `=======` / `>>>>>>>` markers, and write the correct merged content.
2. Stage: `git add <each resolved file>`.
3. Continue, accepting default messages: `GIT_EDITOR=true git rebase --continue`.
4. If it reports more conflicts, repeat from step 1. Loop until it prints `Successfully rebased`.
5. Re-run the preflight. The branch is now up to date (`behind_count: 0`); the script proceeds to gather.

**Never `git rebase --skip` a real conflict** — that drops work. If a conflict is genuinely unresolvable, stop and report it.

**Exit 0:** the JSON has `commits[]`, `implementation_files[]`, `context_files[]`, `context_artifacts[]`, `diff_stat`. Proceed to Phase 3.

### Phase 3: Description Synthesis

You have these inputs from the preflight JSON:

| Field | What it tells you |
|---|---|
| `commits[]` | commit subjects, authors, dates — the narrative arc |
| `implementation_files[]` | the **implementation**: code, config, docs that changed — everything **except** `.context/**`. This is what the PR delivers. |
| `context_files[]` | **every** changed `.context/**` file (artifacts, memory, index, backlog, …). Research/development context that **informed** the work — **not** implementation. |
| `diff_stat` | summary string for the **implementation** diff only (`.context/**` excluded) |
| `context_artifacts[]` | the **parsed subset** of changed `.context/**` files named `plan-`/`spec-`/`brainstorm-`/`research-`/`phase-*.md`, with title/goal/status extracted. Not every `context_files[]` entry appears here (memory/index/backlog files are excluded). |
**Read `.context/**` as the research that informed the work — never as the work itself.** `context_artifacts[]` and `context_files[]` capture the planning, specs, and research that **guided** the implementation; they are **not** deliverables. Use them to explain *why* the implementation looks the way it does, and to cross-check that `implementation_files[]` actually delivers what was planned. For each artifact in `context_artifacts[]`, read the file at `path` to extract:
- The `## User Goal` or `goal:` field (what the user wanted → drives the "What & Why")
- The `scope` or `affected files` (what was planned → compare against `implementation_files[]`)
- The `verification` criteria (how success was defined → drives "Verification Steps")
- Any risks or constraints noted (→ drives "Known Risks")
**Synthesize a PR description** with two distinct sections: one for humans (scannable, impact-focused) and one for agents (technical, actionable).

**Description format** (markdown, for the PR body):

```markdown
<!-- For Humans -->

## What & Why

<2-3 sentences: what this PR does and the problem it solves. Lead with impact.>

## Impact

- **User-facing**: <what users see or experience differently, or "None — internal change">
- **Breaking changes**: <any API/config/behavior breaks, or "None">
- **Performance**: <any measurable improvements or regressions, or "No change">

## High-Level Changes

<3-5 bullet points max. Group related files by concern area, not a flat list.>

- **<area 1>**: <what changed and why in one sentence>
- **<area 2>**: <what changed and why in one sentence>

---

<!-- For Agents -->

## Agent Context

> This section is for AI agents and automated reviewers. Humans can skip it.

### Verification Steps

<Exact commands to verify this PR works. Copy-pasteable.>

```bash
# Example:
npm test
npm run build
# Browser verification:
npm run dev
# Then visit http://localhost:3000 and check <specific behavior>
```

### Files Changed

<List **only** `implementation_files[]` — never `.context/**`. Group by type.>

**Source files:**
- `path/to/file.ts` — <what changed, line count if relevant>
- `path/to/another.ts` — <what changed>

**Test files:**
- `path/to/test.spec.ts` — <what was tested>

**Config/docs:**
- `package.json` — <dependency added/removed>
- `README.md` — <what was documented>

### Technical Details

- **Approach**: <key implementation decisions from plan/spec if available>
- **Dependencies**: <any new deps added, or "None">
- **Migration**: <any data/config migration needed, or "None">

### Research & Planning Context

<If `context_artifacts[]` is non-empty, reference the `.context/**` research that **informed** this work. Frame it as background that guided the implementation — not as part of the deliverable.>

- **Plan**: `.context/YYYY-MM-DD.subject/plan-*.md` — <goal summary>
- **Spec**: `.context/YYYY-MM-DD.subject/spec-*.md` — <requirement summary>
- **Research**: `.context/YYYY-MM-DD.subject/research-*.md` — <key findings>

### Known Risks

- <Specific technical risk>
- <Edge case to watch for>
- <Follow-up work needed, with issue link if exists>

### Reproduction Steps

<If this PR fixes a bug, how to reproduce the original issue>

1. <step 1>
2. <step 2>
3. Expected: <what should happen>
4. Before this PR: <what happened>
5. After this PR: <what happens now>
```

**Writing guidelines:**
- The **Human section** (top) should be scannable in 15 seconds. No jargon, no file paths, focus on impact.
- The **Agent section** (bottom) should be copy-pasteable. Exact commands, exact file paths, exact verification steps.
- If `context_artifacts[]` is empty, omit the "Research & Planning Context" subsection entirely. Never list `.context/**` files under "Files Changed".
- If there are no known risks, omit "Known Risks" or write "None identified."
- If this is not a bug fix, omit "Reproduction Steps."
- Keep both sections tight. No filler. A good PR description is useful, not long.

### Phase 4: Workflowz (Parallel Polish)

If the harness supports **parallel subagents** (omp `task`, pi subagents, codex parallel, claude sub-agents, opencode tasks, etc.), spawn one to polish the description:

**Polish prompt** (send to subagent):

```
You are a PR description polisher. You will receive:
1. A draft PR description with two sections (Humans at top, Agents at bottom)
2. The preflight JSON (commits, `implementation_files[]`, `context_files[]`, `context_artifacts[]`)

Your job:
HUMANS section:
- Tighten the summary — cut filler, lead with impact
- Ensure Impact bullets are accurate (no false breaking-change claims)
- Keep High-Level Changes to 3-5 bullets, grouped by concern

AGENTS section:
- Verify the Verification Steps commands are correct and copy-pasteable
- Verify Files Changed lists only `implementation_files[]` (never `.context/**`)
- Ensure technical details reflect what's actually in the diff
- If context artifacts contain verification criteria, make sure they're referenced; `.context/**` is research context, not a deliverable
- Ensure the markdown structure is preserved (### headings, code blocks, lists)

Do NOT merge the two sections. The human/agent boundary must stay clear.
Return ONLY the polished markdown description. No preamble, no explanation.
```

**If no parallel subagent is available**, skip this phase — the description from Phase 3 is used directly. Do not block on this.

### Phase 5: Create the PR

There is **no confirmation gate**: the base was resolved in Phase 1 and the branch is rebased and up to date after Phase 2, so create directly. Log the shape once for the record, then create:

```
Creating PR:
  Branch: <head> → <base>
  Commits: N   Files changed: N
```

**PR title**: first commit subject if descriptive, else synthesize a short title from the description's summary. Max 72 chars, Conventional Commits style if the commits use it.

**Body**: write the description to a temp file and pass via `--body-file` to avoid shell quoting:

```bash
cat > /tmp/pr-body.md << 'PR_BODY_EOF'
<description markdown>
PR_BODY_EOF

gh pr create --base <base> --title "<title>" --body-file /tmp/pr-body.md [--draft]
```

If `--dry-run` was specified, **stop before** `gh pr create` and report what would have been created.

**If `gh pr create` fails**, surface the error. Common issues:
- No commits between base and head → branch already merged or empty
- Push required → `git push -u origin <branch>` first
- Auth issue → `gh auth login`

### Phase 6: Report

After successful creation, report:

```
✅ PR #<N> created: <url>
  Title: <title>
  Base: <base>
  Head: <branch>
  Draft: yes/no
```


## Behavior Rules

- **The base branch is resolved once, then cached.** First run detects candidates and asks the user; the pick is written to `.git/b-pr-base` and reused without asking. Override with `--base <name>` (re-caches) or `--no-cache` (re-prompt once).
- **There is no PR-creation confirmation gate.** The base is resolved in Phase 1 and the branch is rebased + current after Phase 2; Phase 5 creates directly. `--dry-run` is the preview escape hatch.
- **The script rebases automatically.** Do not hand the user `git fetch && git rebase` — the preflight does it. Only exit 3 (conflict) needs you.
- **Resolve rebase conflicts yourself, in full.** Never `git rebase --skip` to dodge one. Loop resolve → `git add` → `git rebase --continue` until `Successfully rebased`, then re-run the preflight.
- **Never auto-push.** If the branch hasn't been pushed, tell the user to push first.
- **Never create a PR against a protected branch** the user did not choose. The first-run prompt is the confirmation; cached bases were confirmed on first use.
- **Do not pad the description.** A short, accurate description beats a long one full of filler.
- **The script is the source of truth** for branch names, commit counts, and the `implementation_files[]` / `context_files[]` split. Do not re-derive these from memory, and do not move `.context/**` files into "Files Changed".
- **`--dry-run` never creates or rebases anything.** It reports what would be created and stops.

## `.context/**` Is Research, Not Implementation

The preflight script surfaces `.context/**` changes in two fields, both framed as research/development context that **informed and guided** the implementation:

- `context_files[]` — **every** changed `.context/**` file (artifacts, memory, index, backlog, …).
- `context_artifacts[]` — the **parsed subset** whose names mark them as research artifacts:
  - `plan-*.md` → goal, scope, verification, risks
  - `spec-*.md` → requirements and user goal
  - `brainstorm-*.md` → motivation and approach
  - `research-*.md` → technical decisions
  - `phase-*.md` → current phase scope

These **guided** the implementation; they are **not** part of it. Only `.context/**` files that **changed** in this diff are surfaced — stale, unrelated plans never leak in. If no `.context/**` files changed, both fields are empty and the description is generated from `implementation_files[]` alone, which is correct for ad-hoc work.

If artifacts exist but the implementation doesn't match them (e.g., the plan mentioned files that weren't changed), note the discrepancy in the description's Risks section rather than silently ignoring it.

## Cross-References

- `skills/code-review/` — the sibling skill for reviewing PRs after they're created
- `skills/b-review/` — reviews implementation against a plan before PR creation
- `skills/b-save/` — records session state; typically run before `/b-pr` to ensure `.context/` is up to date
- `skills/git-commit/` — commits changes; typically run before `/b-pr`
- **Recommended flow**: `/b-build` → `/b-review` → `/b-docs` → `/b-save` → `/b-commit` → `/b-pr`
