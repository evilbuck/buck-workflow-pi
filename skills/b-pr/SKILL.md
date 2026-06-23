---
name: b-pr
description: Create a GitHub pull request from the current feature branch. Detects and verifies the base branch with the user, checks rebase status, generates a description from the implementation diff — using `.context/**` artifacts only as the research that informed the work (never as part of it) — optionally polishes via a parallel subagent, then creates the PR via `gh`.
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
/b-pr              # interactive: detect base, confirm, gather, create
/b-pr --base main  # skip base detection, use 'main' directly
/b-pr --draft      # create as draft PR
/b-pr --dry-run    # show what would be created without creating it
```

## Procedure

### Phase 1: Preflight — Detect Base Branch

Run the preflight script **without** `--base` to detect candidates:

```bash
bun skills/b-pr/scripts/pr-preflight.ts
```

The script outputs JSON with `base_candidates` — branches that exist as remote refs (main, master, dev, develop). It also reports the current branch.

**If `--base` was provided by the user**, skip ahead to Phase 2 with that value.

Otherwise, **STOP and present the candidates to the user**:

```
Current branch: feature/my-thing

Detected base branches:
1. main (origin/main)
2. dev (origin/dev)

Which is the target base for this PR?
```

**WAIT for user input.** Do not guess. The user may also type a branch name not in the list — accept it and validate in Phase 2.

### Phase 2: Preflight — Full Gather + Rebase Check

Re-run the preflight script with the confirmed base:

```bash
bun skills/b-pr/scripts/pr-preflight.ts --base <confirmed>
```

The script now:
1. Validates the chosen base exists
2. Checks if the feature branch is **behind** the base (commits on base not in feature)
3. If behind → exits with code 2 and `needs_rebase: true`
4. If current → gathers commit log, `diff_stat`/`implementation_files[]` (the implementation), and `context_files[]` + `context_artifacts[]` (the `.context/**` research that informed it)

**If the script exits with code 2 (needs rebase):**

```
⚠️ Feature branch is N commit(s) behind <base>.

Rebase before creating the PR:
  git fetch origin
  git rebase origin/<base>

Then re-run /b-pr.
```

**STOP. Do not create the PR.**

**If the script exits with code 1 (error):** Surface the error message and stop.

**If the script exits with code 0:** Parse the JSON output and proceed to Phase 3.

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

### Phase 5: User Review

Present the final description to the user:

```
PR Draft:
  Branch: feature/my-thing → main
  Commits: N
  Files changed: N

Description:
<paste the full description>

Create this PR? [y/n/edit]
```

- **y** → proceed to Phase 6
- **n** → abort
- **edit** → let the user provide edits, then re-present

If `--draft` was specified, note it: `Create this draft PR? [y/n/edit]`

If `--dry-run` was specified, stop here and report what would have been created.

### Phase 6: Create the PR

Build the `gh pr create` command:

```bash
gh pr create \
  --base <confirmed-base> \
  --title "<PR title>" \
  --body "<PR description>" \
  [--draft]  # only if --draft was specified
```

**PR title**: Use the first commit subject if it's descriptive, or synthesize a short title from the description's summary. Max 72 chars. Follow Conventional Commits style if the commits do.

**Body**: Pass via `--body-file` to avoid shell quoting issues. Write the description to a temp file:

```bash
# Write description to temp file
cat > /tmp/pr-body.md << 'PR_BODY_EOF'
<description markdown>
PR_BODY_EOF

gh pr create --base <base> --title "<title>" --body-file /tmp/pr-body.md [--draft]
```

**If `gh pr create` fails**, surface the error. Common issues:
- No commits between base and head → branch already merged or empty
- Push required → `git push -u origin <branch>` first
- Auth issue → `gh auth login`

### Phase 7: Report

After successful creation, report:

```
✅ PR #<N> created: <url>
  Title: <title>
  Base: <base>
  Head: <branch>
  Draft: yes/no
```

## Behavior Rules

- **Never create a PR without user confirmation** of both the base branch and the description.
- **Never auto-push.** If the branch hasn't been pushed, tell the user to push first.
- **Never create a PR against a protected branch** unless the user explicitly confirms it. If the base is `main`/`master`/`dev`/`develop`, add a warning:
  ```
  ⚠️ Target base is a protected branch (<base>). Are you sure? [y/n]
  ```
- **Do not create the PR if the branch needs rebasing.** Fix the rebase first.
- **Do not pad the description.** A short, accurate description beats a long one full of filler.
- **The script is the source of truth** for branch names, commit counts, and the `implementation_files[]` / `context_files[]` split. Do not re-derive these from memory, and do not move `.context/**` files into "Files Changed".
- **`--dry-run` never creates anything.** It stops after Phase 5 and reports.

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
