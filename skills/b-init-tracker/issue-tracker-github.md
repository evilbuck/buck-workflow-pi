# Issue tracker: GitHub

Issues live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <path>` (use a body file for multi-line content).
- **Read an issue**: `gh issue view <number> --comments`, or `read issue://<number>` for the internal reader shortcut.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`.
- **Comment**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically inside a clone. Add `--repo <owner>/<name>` when running out-of-tree.

## Pull requests as a triage surface

**PRs as a request surface: no** by default. Set to `yes` in this file if
this repo treats external PRs as feature requests that `b-triage` should
read.

When set to `yes`, PRs run through the same labels and states as issues,
using the `gh pr` equivalents (`gh pr view`, `gh pr diff`, `gh pr comment`,
`gh pr edit --add-label`, `gh pr close`). Keep only external authors
(`authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`)
in discovery; an explicitly named PR is always triaged regardless of author.

GitHub shares one number space across issues and PRs — a bare `#42` may be
either; resolve with `gh pr view 42`, falling back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
