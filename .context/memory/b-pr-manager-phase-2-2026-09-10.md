---
date: 2026-09-10
domains: [extensions, git, testing]
topics: [b-pr-manager, pr-git, rebase, force-with-lease, phase-2]
related: [b-pr-manager-phase-1-2026-09-10.md]
priority: high
status: completed
subject: 2026-09-10.b-pr-manager
artifacts:
  - extensions/pr-git.ts
  - extensions/pr-git.test.ts
  - extensions/b-pr-improved/index.ts
  - skills/b-pr/scripts/pr-preflight.ts
---

# b-pr-manager Phase 2 — shared PR git primitives

Extracted `extensions/pr-git.ts` from `/b-pr-improved`. Review Pass.

## Decisions
- `.git/b-pr-base` still stores `branch\\n` under the worktree gitdir.
- Push: ordinary `git push` when fast-forwardable; `--force-with-lease` only when rewritten published history is allowed; never `--force`.
- Never `rebase --abort` or `reset --hard`. Unexpected rebase state returns a typed result.
- In-progress rebase is preflight exit 3 with `rebase_in_progress: true` (same code as a fresh conflict), not a generic exit 1 `die()`.
- `pushBranchIfAhead` lives in `pr-git.ts`; b-pr-improved imports it (no re-export alias).

## Verification
- `npx vitest run extensions/pr-git.test.ts extensions/b-pr-improved/__tests__/wire.test.ts` — 15 passed
- pr-git.ts line coverage 96.1%

## Next
Phase 3: deterministic GitHub inventory (`phase-3-github-inventory.md`, medium).
