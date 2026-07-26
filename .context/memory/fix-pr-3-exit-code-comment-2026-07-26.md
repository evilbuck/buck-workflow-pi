---
date: 2026-07-26
domains: [review, fixes, docs]
topics: [fix-pr, pr-3, b-pr, pr-preflight, exit-codes, comment-update]
related: [".context/memory/fix-pr-3-2026-07-25.md", ".context/memory/b-pr-preflight-autostash-2026-07-26.md"]
priority: medium
status: completed
subject: fix-pr-3-exit-code-comment
artifacts: ["skills/b-pr/scripts/pr-preflight.ts"]
---

# fix-pr: PR #3 carried-forward comment fix (exit-codes)

## PR
- URL: https://github.com/evilbuck/buck-workflow-pi/pull/3
- Branch: feat/deterministic-git-commit
- HEAD before: f0b5575 (fix(b-pr): autostash dirty tree on preflight rebase)
- HEAD after: 9a1f80d (fix(b-pr): update stale exit-code comment block)
- Pushed: yes (via worktree `~/buck-workflow-pi-pr3`)

## Validation table

| # | Source | Commit | Claim | Verdict | Disposition |
|---|---|---|---|---|---|
| 1 | review #1 F1 | 6758f5e | bash `-c` shell injection in commit-preflight subject-folder picker | already_done | replaced with `readdirSync` at commit-preflight.ts:3927 in 20336ae; regression test in wire.test.ts:1033 |
| 2 | review #1 F2 | 6758f5e | `b-kamal-release` v-prefix double-strip between `resolveVersion` and `runKamalRelease` | already_done | prefix now passed through as `proposal.prefix`; regression test in wire.test.ts:1989 |
| 3 | review #1 F3 | 6758f5e | `b-commit-improved --dry-run` + no model prints misleading "Drafted to ${path}. Re-run ... to commit" | already_done | dual-branch message at extensions/b-commit-improved/index.ts:425–445 |
| 4 | review #2 F1 | 82346ae | `parseArgs` value-flag guard inconsistent across extensions | already_done | guards at extensions/b-commit-improved/index.ts:251 and extensions/b-pr-improved/index.ts:283 |
| 5 | review #2 F2 + re-review carry-forward | f0b5575 | exit-code comment block at skills/b-pr/scripts/pr-preflight.ts:12–15 omits code 1 and misframes code 2 | valid | **fixed in 9a1f80d** — comment now lists 0/1/2/3 with current semantics |

## Fix applied (commit 9a1f80d, 1 file / +4 -3)

Comment block in `skills/b-pr/scripts/pr-preflight.ts`:

```text
// Exit codes:
//   0 = success (base resolved, gathered)
//   1 = error (not a git repo, gh not auth, rebase in-progress, etc.)
//   2 = behind + --dry-run (would rebase; reported and stopped)
//   3 = rebase conflict (resolve, then re-run)
```

Comment-only change; no runtime impact.

## Verification

- `bun x vitest run extensions/b-pr-improved/__tests__/wire.test.ts` → 7/7 pass.
  - Covers `die()` JSON dual-channel (exit 1 path the comment now documents).
  - Covers autostash round-trip with dirty tracked files and `--diff-filter=U` conflict detection (exits 2 and 3 paths the comment now documents).
- `git status` clean; `git push -u origin HEAD` succeeded.
- PR comment posted: https://github.com/evilbuck/buck-workflow-pi/pull/3#issuecomment-5085406831

## Notes

- Worktree workflow worked: created `~/buck-workflow-pi-pr3` on `feat/deterministic-git-commit`, symlinked `node_modules` from the main checkout (git worktrees don't copy `node_modules`), all `bun x vitest` invocations needed `cd` to the worktree directory because shell cwd doesn't persist between `bash` calls.
- The `edit` tool was observed to apply patches to whichever worktree the bash session's cwd pointed to (the session cwd was the parent `buck-workflow-pi` repo, not the PR worktree). Worked around by:
  1. Resetting any stray edits from the main repo with `git checkout -- <path>`
  2. Applying the comment update via `python3 -c "..."` with an absolute file path on the PR worktree
- All prior review findings (r1 F1–F3, r2 F1) verified actually-resolved by reading the code — not just trusting the reviews' "RESOLVED" assertions. This caught no actual drift, but the explicit check was cheap.
