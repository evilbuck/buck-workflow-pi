---
date: 2026-09-18
domains: [testing, tooling]
topics: [buck-loop, smoke-test, todo-cli, nested-sessions]
related: [buck-loop-remaining-phases-2026-09-18.md]
priority: high
status: completed
---

# buck-loop todo smoke project

Created an isolated executable smoke project at `/home/buckleyrobinson/projects/development_tools/buck-loop-smoke-todo`.

## Contract

- One pending easy phase builds a dependency-free persistent Node.js todo CLI.
- Acceptance covers exact add/list/done output, separate-process persistence, invalid input, malformed JSON, tests, review, b-save, and b-commit.
- `run-loop.sh` loads the uncommitted extension directly from `../autonomous-loop.wt/extensions/index.ts` with ordinary extension discovery disabled.

## Baseline

- Initial Git commit: `b3e0fb3` (`chore: scaffold buck-loop todo smoke project`).
- Real `scan()` resolved `phase-1-todo-cli.md` with `planFacts.kind: phased-incomplete`, pending review, and pending work.
- OMP loaded the explicit extension and accepted `/buck-loop --status` without an extension-load error.

## Live outcome

- The final real OMP run transitioned `idle → resolving → building → reviewing → saving → committing → done`.
- The nested commit advanced HEAD to `209fbca` and left the smoke repository clean.
- `npm test` passed 18/18.
- Manual add → list → done → list printed the four exact planned output lines.
