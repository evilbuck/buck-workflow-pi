---
date: 2026-07-26
status: completed
topics: [b-pr, pr-preflight, autostash, rebase, dirty-tree]
related:
  - skills/b-pr/scripts/pr-preflight.ts
  - skills/b-pr/SKILL.md
  - extensions/b-pr-improved/__tests__/wire.test.ts
memory:
  - b-pr-preflight-autostash-2026-07-26.md
---

# b-pr preflight autostash

## Summary

`/b-pr-improved` failed on a dirty working tree with `Preflight failed (exit 1): no output`. Root cause: `pr-preflight.ts` ran plain `git rebase`, which refuses unstaged changes, and `die()` only wrote to stderr so the extension saw empty stdout.

## Outcome

- Rebase uses `git rebase --autostash <base>` so local WIP is stashed/restored around the rebase.
- `die()` also emits `{"error":"..."}` on stdout for orchestrators.
- Skill docs and two new tests cover the path.

## User Goal

Technical chore — operational hardening of deterministic PR preflight after a live failure; no product feature.
