---
name: b-issue-create
description: Create a GitHub issue from the active buck-workflow plan/spec/research context. Produces an AFK-ready handoff issue, records subject-local and backlog artifacts, pushes the branch when needed, and links the issue back into `.context/`.
---

# b-issue-create: Plan → GitHub Issue Handoff

Turn the current plan/spec/research state into a GitHub issue another agent loop can pick up without chat context.

## Use when

- A plan is finalized and needs to be turned into a GitHub issue
- A subject folder already contains the implementation context, but the work is not yet represented in the repo issue tracker
- You need a handoff issue that references the active branch, plan, research, memory, and any presentation/blueprint artifacts

## Do not use when

- The work is still being scoped or grilled
- The issue would just restate a vague idea without concrete acceptance criteria
- The user asked for implementation rather than handoff packaging

## Inputs to gather

1. **Active subject artifacts**
   - plan: `plan-*.md`
   - spec/research/brainstorm/phase artifacts if present
   - subject `index.md`
   - presentation artifacts such as `presentations/**/blueprint.html` or `presentations/**/index.html`
2. **Repo bookkeeping**
   - `.context/memory/index.md`
   - `.context/backlog/todo.md`
   - `.context/specs/index.md`
3. **Repo state**
   - current branch
   - whether `.context` or presentation files need a commit
   - whether the branch exists on origin
4. **Issue-tracker conventions**
   - `docs/agents/issue-tracker.md`
   - `docs/agents/triage-labels.md`

## Required outputs

1. **Subject-local issue artifact** in `.context/<subject>/items/<slug>.md`
2. **Global backlog item** in `.context/backlog/items/<slug>.md`
3. **GitHub issue body artifact** in the subject folder (recommended: `github-issue-<slug>.md`)
4. **Published GitHub issue** with the branch and context artifacts linked in the body
5. **Session memory** plus updated `.context/memory/index.md`
6. Updated subject `index.md` and issue artifact with the GitHub issue URL

## Default procedure

### Phase 1 — Confirm the source material

1. Read the recent memory index and backlog first.
2. Identify the active subject folder and read its `index.md`.
3. Read the plan/spec/research artifacts that define:
   - goal
   - scope
   - out-of-scope line
   - fixed decisions
   - acceptance criteria
   - risks
4. If a presentation exists, include it. Presentations are part of the handoff, not optional garnish.

If the plan is still unresolved or missing acceptance criteria, stop and tighten the plan first instead of creating a weak issue.

### Phase 2 — Draft the handoff artifact

Create `.context/<subject>/items/<slug>.md` with frontmatter like:

```yaml
---
title: <human title>
status: active
priority: high|medium|low
created: YYYY-MM-DD
updated: YYYY-MM-DD
completed: null
branch: <current branch>
github_issue: null
related:
  - .context/<subject>/plan-*.md
  - .context/<subject>/research-*.md
  - presentations/.../blueprint.html
---
```

The body should be AFK-ready. Include:
- summary
- why now / problem
- branch
- GitHub issue placeholder
- plan/research/presentation links
- fixed decisions
- required deliverables
- acceptance criteria
- risks/watchpoints
- suggested execution order
- verification expectations for the implementing agent

The issue body should read like a clean handoff brief, not like a planning diary.

### Phase 3 — Write the GitHub issue body file

Create a markdown file in the subject folder, typically:

```text
.context/<subject>/github-issue-<slug>.md
```

Structure:

```md
## Summary
<one-paragraph outcome>

## Branch / artifacts
- Planning branch: `feature/...`
- Plan: `...`
- Research: `...`
- Presentation: `...`

## Why
<problem and reason this should exist>

## Fixed decisions
1. ...

## Deliverables
### Token / API / UI / Docs sections
...

## Acceptance criteria
- [ ] ...

## Suggested execution order
1. ...

## Verification expectations
- exact commands and browser checks the implementing agent should run
```

Rules:
- Include the branch.
- Include the presentation when one exists.
- Make acceptance criteria executable, not aspirational.
- Keep it specific enough that another agent can start cold.

### Phase 4 — Bookkeeping before publication

1. Add a global backlog item pointing to the subject-local issue.
2. Add or update the subject `index.md` so it references the issue artifact and presentation.
3. If these `.context` artifacts are new or changed, commit them.

Recommended commit style:

```bash
git add <relevant .context files> <presentation files>
git commit -m "docs(context): add <topic> issue handoff"
```

Commit only the handoff artifacts you created. Do not sweep unrelated app changes into the commit.

### Phase 5 — Push the branch

If the branch is not on origin or the new context commit is not pushed, push it:

```bash
git push -u origin <branch>
```

The issue should reference a branch another agent can actually check out.

### Phase 6 — Create the GitHub issue

1. Inspect available labels.
2. Prefer:
   - `ready-for-agent` if it exists and the issue is fully specified
   - otherwise `needs-triage`
3. Add a category label like `enhancement`, `bug`, or `documentation` when appropriate.

Create the issue with `gh issue create --body-file` so quoting does not rot the markdown.

Example:

```bash
gh issue create \
  --title "<title>" \
  --body-file .context/<subject>/github-issue-<slug>.md \
  --label enhancement \
  --label needs-triage
```

### Phase 7 — Link the issue back into `.context`

After creation:

1. Update subject-local issue frontmatter `github_issue:` with the URL
2. Add the issue URL to the body of:
   - subject-local issue artifact
   - backlog item
   - subject `index.md`
3. Write a session memory file documenting:
   - issue URL
   - branch
   - artifacts touched
   - verification performed
4. Update `.context/memory/index.md`

## Verification

Before yielding, confirm all of these:

1. `gh issue create` returned a real issue URL
2. `read issue://<N>` shows the expected body, labels, and open state
3. `git push` succeeded for the referenced branch
4. The subject-local issue artifact contains the GitHub issue URL
5. The backlog item exists
6. The subject `index.md` mentions the issue and presentation
7. Memory + memory index are updated

## Behavior rules

- **Do not create a GitHub issue from an unresolved plan.** Finish the plan first.
- **Do not omit the presentation** when one exists.
- **Do not leave the issue body generic.** It must be cold-startable by another agent.
- **Do not bundle unrelated code changes** into the handoff commit.
- **Do not assume `ready-for-agent` exists.** Inspect repo labels first.
- **Do not stop at the GitHub issue.** Local `.context` artifacts must be updated too.
- **Do not skip memory/backlog/spec bookkeeping.** The issue itself is not enough.

## Recommended issue body checklist

- [ ] States the problem in repo terms
- [ ] Names the active branch
- [ ] Links plan, research, and presentation artifacts
- [ ] Lists fixed decisions so the next agent does not re-open them
- [ ] Lists required deliverables
- [ ] Includes acceptance criteria
- [ ] Includes verification expectations
- [ ] Calls out out-of-scope work

## Closeout report format

When finished, report:

```text
Created.
- GitHub issue: #N — <url>
- Branch pushed: `<branch>`

Recorded handoff artifacts:
- <path>
- <path>

Verification:
- `git push -u origin <branch>` → <result>
- `gh issue create ...` → <url>
- `read issue://N` confirmed labels/body/state
```

## Related skills

- `b-plan` — create the bounded plan first
- `b-phase` — split oversized plans before handoff
- `b-present` / `b-blueprint` — generate presentation artifacts that should be linked in the issue
- `b-save` — checkpoint broader session state when needed
- `b-pr` — sibling skill for turning implemented work into a PR rather than an issue
