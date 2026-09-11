---
status: active
date: 2026-09-11
subject: 2026-09-11.fix-pr-open-prs
topics: [fix-pr, herdr, omp, worktrees, manage-herdr-panes]
---

# Subject: fix-pr open PRs via Herdr omp pane

Driver: this session (`w8:p2`).
Runner: Herdr pane `w8:p9`, agent name `pr-fixer`, kind `omp`.
Skill used to launch: `skills/manage-herdr-panes/SKILL.md`.
Work skill: `fix-pr`.

**Done rule (user 2026-09-11):** between fixes, wait for more reviews. A PR
leaves the loop only when all review threads are completed **and** a last
GitHub review states that issues have been resolved. Settlement window: CI
`--watch`, then 15 minutes, re-fetch, repeat. Do not author that resolving
review as the PR author.

## Open PRs (oldest first)

| Order | PR | Created | Title |
|---|---|---|---|
| 1 | [#17](https://github.com/evilbuck/buck-workflow-pi/pull/17) | 2026-09-08 | feat(b-eval-upstream-prs): add local-only upstream PR evaluation skill |
| 2 | [#19](https://github.com/evilbuck/buck-workflow-pi/pull/19) | 2026-09-09 | feat(install): add ZCode harness support |
| 3 | [#20](https://github.com/evilbuck/buck-workflow-pi/pull/20) | 2026-09-11 | feat(b-kickoff): add OMP goal objective for unattended Buck loops |
| 4 | [#21](https://github.com/evilbuck/buck-workflow-pi/pull/21) | 2026-09-11 | docs(plan): close mattpocock remediation plan |

Repo: `evilbuck/buck-workflow-pi`.
