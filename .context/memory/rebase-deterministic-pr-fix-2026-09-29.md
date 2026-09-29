---
date: 2026-09-29
domains: [git, docs]
topics: [rebase, deterministic-pr-fix, additive-conflicts]
related:
  - .context/memory/index.md
  - docs/howto/README.md
priority: low
status: completed
---

# Rebase conflict resolution: deterministic-pr-fix

Resolved the two additive index conflicts while replaying `782bafd` onto `origin/feat/deterministic-pr-fix`. Upstream contributed fix-pr Phase 2 and buck-loop recovery memory entries; the replayed commit contributed four PostgreSQL memory entries. All entries from both sides were retained, with a blank separator between the groups. The how-to index retains both recovery and SQL recall guides, numbered 6 and 7 respectively.

Verification: an inline Node assertion script compared the resolved indexes against Git index stages 2 and 3 and verified every indexed entry from both sides survived. No conflict markers remained. How-to numbering was exactly 1–7; all how-to targets and newly merged memory targets existed. Both files were staged; scoped `git diff --cached --check` passed; `git diff --name-only --diff-filter=U` was empty.

This session changed only Markdown indexes and this resolution record. Code and other already-staged replay changes were left untouched; project code gates were not run. No backlog item was added or completed: this was an immediate Git-operation repair, not a feature/phase completion.

Manual gate: rebase remains paused. No continue, commit, abort, or push was performed. Review the staged resolution and run `git rebase --continue`; later replayed commits may produce further conflicts.
