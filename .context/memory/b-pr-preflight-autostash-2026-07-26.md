---
date: 2026-07-26
domains: [debugging, implementation, testing, skill]
topics: [b-pr, b-pr-improved, pr-preflight, autostash, rebase, dirty-tree, json-error]
related:
  - skills/b-pr/scripts/pr-preflight.ts
  - skills/b-pr/SKILL.md
  - extensions/b-pr-improved/__tests__/wire.test.ts
  - extensions/b-pr-improved/index.ts
  - .context/memory/b-pr-improved-worktree-enotdir-2026-07-24.md
  - .context/memory/b-pr-improved-auto-push-2026-07-23.md
priority: medium
status: completed
subject: 2026-07-26.b-pr-preflight-autostash
artifacts:
  - index.md
---

# b-pr preflight: dirty-tree autostash + JSON die()

## Problem

Live `/b-pr-improved --base master` on `feat/deterministic-git-commit` reported:

```text
Warning: Preflight failed (exit 1): no output
```

Direct script run showed the real failure:

```text
error: cannot rebase: You have unstaged changes.
error: Please commit or stash them.
```

Local WIP at the time: modified `.context/memory/index.md`, untracked memory note. The script already knew dirty-tree was a likely cause (`die(...likely a dirty tree or hook...)`) but did not handle it, and `die()` only printed to stderr — `runPreflight` in the extension only parses stdout JSON, so the UI collapsed to "no output".

## Fix

In `skills/b-pr/scripts/pr-preflight.ts` (shared by skill + `b-pr-improved`):

1. **`git rebase --autostash <base>`** — git stashes dirty tracked files before rebase and pops after. Untracked files are not in autostash scope (git default); they do not block rebase.
2. **`die()` dual-channel** — keep human stderr line; also `console.log(JSON.stringify({ error: msg }))` so orchestrators surface the message.

Docs: `skills/b-pr/SKILL.md` Phase 2 + Behavior Rules note `--autostash` and drop "dirty tree" from the exit-1 "ask user to clean" framing.

## Tests

`extensions/b-pr-improved/__tests__/wire.test.ts` — two new cases:

- Dirty tracked file + behind base → exit 0, `rebased: true`, WIP content restored, main is ancestor of HEAD.
- Non-git cwd → exit 1 with parseable `{ error }` on stdout.

`npx vitest run extensions/b-pr-improved/__tests__/wire.test.ts` — **7/7 passed**.

Live smoke: non-repo `die()` emits JSON; `--dry-run --base master` still exits 2 without mutating (branch 1 behind / 3 ahead at save time).

## Non-goals / deferred

- No extension change required — preflight is the single source of truth.
- Did not introduce a custom stash/pop wrapper; git's `--autostash` is sufficient.
- Untracked files still outside autostash (by design of git); they never blocked the rebase.

## Next

`/b-commit` then re-run `/b-pr-improved --base master` on a dirty tree to confirm end-to-end.
