---
status: completed
date: 2026-08-26
subject: 2026-08-26.b-commit-placeholder-sentinels
topics: [b-commit-improved, draft-commit, placeholders, sentinels]
memory: [b-commit-improved-placeholder-sentinels-2026-08-26.md]
---

# b-commit-improved placeholder sentinels

## User Goal

`/b-commit-improved` left `feat: <short summary>` in a real commit. Diagnose, fix, and use one unfilled-draft convention so that cannot happen again.

## What shipped

- Unfilled `draft-commit.md` writes `$TITLE` / `$BODY` only
- Angle brackets stay in prose as format docs, never as `## Title`
- Detector still refuses leftover `<short summary>` (legacy stub that looks like a Conventional Commit)
- `List<T>` is not a match
- Skills updated: `git-commit-improved`, `git-commit`, `b-build`, `b-iterate`

## Verification

`npx vitest run extensions/b-commit-improved/__tests__/wire.test.ts` — 16/16

## Related

Original plan: `.context/2026-07-25.git-commit-improved/plan-git-commit-improved.md`
Memory: `.context/memory/b-commit-improved-placeholder-sentinels-2026-08-26.md`

HEAD `30e0849` still has the bad subject — not rewritten this session.
