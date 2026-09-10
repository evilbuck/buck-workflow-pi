# Issue tracker: GitLab

Issues live as GitLab issues. Use the [`glab`](https://gitlab.com/gitlab-org/cli) CLI for all operations.

## Conventions

- **Create an issue**: `glab issue create --title "..." --description "..."`.
- **Read an issue**: `glab issue view <number>`.
- **List issues**: `glab issue list --state opened`.
- **Comment**: `glab issue note <number> --message "..."`
- **Apply / remove labels**: `glab issue update <number> --label "..."` / `--unlabel "..."`
- **Close**: `glab issue close <number>`

Infer the project from the remote; `glab` does this automatically inside a clone.

## Merge requests as a triage surface

**PRs as a request surface: no** by default (`b-triage` checks this exact
phrase regardless of tracker; GitLab calls these merge requests, but the
config line stays "PRs" for a consistent gate). Set to `yes` in this file if
this repo treats external merge requests as feature requests that
`b-triage` should read, using the `glab mr` equivalents.

## When a skill says "publish to the issue tracker"

Create a GitLab issue.

## When a skill says "fetch the relevant ticket"

Run `glab issue view <number>`.
