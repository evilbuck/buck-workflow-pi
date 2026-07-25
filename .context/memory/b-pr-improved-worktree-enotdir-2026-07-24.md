---
date: 2026-07-24
domains: [debugging, implementation, testing, extensions, git]
topics: [b-pr-improved, linked-worktree, enotdir, git-dir, gh-cli, pull-request]
related:
  - extensions/b-pr-improved/index.ts
  - extensions/b-pr-improved/__tests__/wire.test.ts
  - skills/b-pr/scripts/pr-preflight.ts
priority: high
status: completed
---

# b-pr-improved linked-worktree ENOTDIR fix

`b-pr-improved` constructs its temporary PR body path as `join(cwd, ".git", filename)` in `extensions/b-pr-improved/index.ts:359`. That assumes `.git` is a directory.

In `/home/buckleyrobinson/projects/pp.responsive-manage-photos.wt`, `.git` is the linked-worktree metadata file:

```text
gitdir: /home/buckleyrobinson/projects/partypix/.git/worktrees/pp.responsive-manage-photos.wt
```

Writing beneath that regular file reproduces the reported `ENOTDIR`. `git rev-parse --git-dir` resolves the actual worktree Git directory to `/home/buckleyrobinson/projects/partypix/.git/worktrees/pp.responsive-manage-photos.wt`.

The preflight script already resolves Git-private storage correctly with `git rev-parse --git-dir`; only the extension's PR-body temporary file bypasses that pattern. Its tests initialize ordinary repositories, where `.git` is a directory, and the handler test returns on cache miss before reaching PR-body creation. No linked-worktree/full-create path covers the failure.

The extension now passes the generated description directly to `gh pr create --body`. It no longer creates or cleans up a temporary file beneath `.git`, so ordinary repositories and linked worktrees use the same path-independent invocation.

Verification:
- Before the fix, direct `writeFileSync(<affected-worktree>/.git/b-pr-body-diagnosis.md, ...)` reproduced `ENOTDIR` with Node v26.2.0.
- `npx vitest run extensions/b-pr-improved/__tests__/wire.test.ts` — 5 passed.
- A fake-`gh` smoke test executed the new argument shape from the affected linked worktree and received the multiline PR body unchanged.
- LSP diagnostics for `extensions/b-pr-improved/index.ts` — clean.
