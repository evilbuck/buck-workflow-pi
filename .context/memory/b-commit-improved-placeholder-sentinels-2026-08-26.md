---
date: 2026-08-26
domains: [extensions, git, testing]
topics: [b-commit-improved, draft-commit, placeholders, sentinels]
subject: 2026-08-26.b-commit-placeholder-sentinels
artifacts:
  - index.md
  - draft-commit.md
related:
  - b-commit-improved-2026-07-25.md
priority: high
status: completed
---

# b-commit-improved: $TITLE/$BODY sentinels

## User Goal

Stop `/b-commit-improved` from committing leftover template titles, and standardize unfilled drafts on one sentinel.

## What happened

HEAD `30e0849` is `feat: <short summary>` with a fallback dump as the body. `fallbackDraft` wrote that line as `## Title`. Preflight treats any non-empty title as usable. The refuse list only knew `$TITLE` / `$BODY`. `feat: <short summary>` looks like a Conventional Commit, so the re-run committed it.

## Decision

One written sentinel: `$TITLE` / `$BODY`. Angle brackets document shape in prose only — never in `## Title`. Still refuse leftover `<short summary>` so old drafts cannot commit. `List<T>` is not a match (`<short summary` is the legacy token, not any `<>`).

## What shipped

- `extensions/b-commit-improved/index.ts` — `hasCommitPlaceholders`, stub writer, skip unusable titles, safety check, model parse reject
- `extensions/b-commit-improved/__tests__/wire.test.ts` — stub not committed, legacy bracket title not committed, filled title commits, `List<T>` allowed
- Skills: `git-commit-improved`, `git-commit`, `b-build`, `b-iterate`

## Verification

`npx vitest run extensions/b-commit-improved/__tests__/wire.test.ts` — 16/16

## Leftover

HEAD `30e0849` was not rewritten. Tracked as backlog `rewrite-placeholder-commit-30e0849`.

## Related

- Subject: `.context/2026-08-26.b-commit-placeholder-sentinels/`
- Original plan: `.context/2026-07-25.git-commit-improved/plan-git-commit-improved.md`
