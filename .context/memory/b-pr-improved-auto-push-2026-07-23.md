---
date: 2026-07-23
domains: [implementation, testing, skill]
topics: [b-pr-improved, git-push, pull-request, remote-branch, force-with-lease]
related:
  - extensions/b-pr-improved/index.ts
  - extensions/b-pr-improved/__tests__/wire.test.ts
  - commands/b-pr-improved.md
priority: medium
status: completed
---

# b-pr-improved conditional branch push

Updated the b-pr-improved extension to push the current branch before PR creation when its local commit is ahead of `origin/<branch>`. New branches use `git push -u origin <branch>`; existing branches push only when ahead. A remote divergence is rejected unless the run rebased the branch, in which case `--force-with-lease` preserves the remote safety check.

Dry runs remain side-effect free because the push happens after the dry-run return. Added a throwaway bare-remote test covering initial push, no-op when synchronized, normal ahead push, and guarded force-with-lease after an amend.

Verification:
- `npx vitest run extensions/b-pr-improved/__tests__/wire.test.ts` — 5 passed.
- `git diff --check` — clean.
- `npx tsc --noEmit` — existing repository-wide errors remain in unrelated files; no new b-pr-improved diagnostics were reported.
