---
title: Stop b-commit-improved from committing leftover draft placeholders
status: completed
priority: high
created: 2026-08-26
updated: 2026-08-26
completed: 2026-08-26
related:
  - extensions/b-commit-improved/index.ts
  - extensions/b-commit-improved/__tests__/wire.test.ts
  - .context/2026-08-26.b-commit-placeholder-sentinels/index.md
  - .context/memory/b-commit-improved-placeholder-sentinels-2026-08-26.md
---

# Stop b-commit-improved from committing leftover draft placeholders

User reported `/b-commit-improved` left `<short summary>` in HEAD `30e0849`.

Fixed 2026-08-26: unfilled drafts write `$TITLE`/`$BODY`; leftover `<short summary>` still refused. 16/16 targeted tests.
