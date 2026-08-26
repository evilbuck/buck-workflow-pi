---
title: Rewrite HEAD 30e0849 feat: <short summary> commit message
status: active
priority: low
created: 2026-08-26
updated: 2026-08-26
completed: null
related:
  - .context/2026-08-26.b-commit-placeholder-sentinels/index.md
  - .context/memory/b-commit-improved-placeholder-sentinels-2026-08-26.md
---

# Rewrite HEAD 30e0849

`30e0849` on `feat/deterministic-status-updates` still has subject `feat: <short summary>` from the pre-fix `/b-commit-improved` stub. The tool is fixed; the historical message was not rewritten (user did not confirm amend/reset).

Do not rewrite unless the user asks. If they do: confirm the commit is still HEAD and unpushed, then `git commit --amend` with a real Conventional Commits subject.
