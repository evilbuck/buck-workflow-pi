# Issue tracker: Local markdown

Issues live as markdown files under `.scratch/<feature>/` in this repo.
Good for solo projects or repos without a remote tracker.

## Conventions

- **Create an issue**: write `.scratch/<feature>/<slug>.md` with a short
  frontmatter block (`title`, `status`, `created`) and a body.
- **Read an issue**: read the file directly.
- **List issues**: glob `.scratch/*/*.md`, filter by `status` in frontmatter.
- **Comment**: append a `## Notes (YYYY-MM-DD)` section.
- **Apply / remove labels**: add/remove entries in a `labels:` frontmatter
  array.
- **Close**: set `status: closed` in frontmatter (or move to
  `.scratch/closed/`).

## When a skill says "publish to the issue tracker"

Write a new file under `.scratch/<feature>/`.

## When a skill says "fetch the relevant ticket"

Read the file directly from `.scratch/`.
