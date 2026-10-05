---
date: 2026-09-18
domains: [extensions, git, testing]
topics: [b-commit-improved, commit-preflight, ENOBUFS, maxBuffer]
related: [b-commit-improved-2026-07-25.md]
priority: high
status: completed
subject: 2026-09-18.b-commit-enobufs
artifacts:
  - skills/git-commit-improved/scripts/commit-preflight.ts
  - extensions/b-commit-improved/__tests__/wire.test.ts
---

# b-commit-improved preflight ENOBUFS

`commit-preflight.ts` dumped `git diff --cached` through `execFileSync` with the default 1 MiB `maxBuffer`. Staged patches larger than that failed with `spawnSync git ENOBUFS`; the extension printed `Preflight failed (exit 1): git diff --cached failed: …`.

The model prompt and `fallbackDraft` already truncate the patch to 8000 chars. Gathering the unbounded diff was unnecessary and blew the buffer.

Fix: `gatherStagedDiff()` caps capture at 64 KiB / 8k chars; on ENOBUFS uses partial stdout or `--shortstat` + `--name-status`; still exits 0. Script is spawned from disk — no OMP restart.

Verify: original 2.1 MiB harness exit 0, truncated diff 8016 chars; `vitest run extensions/b-commit-improved` 20/20.

Guardrails: this branch has no `skills/b-guardrails-check/scripts/check.mjs`. Ran master's runner against this worktree. `unit_test_gate` pass, `patch_gate` pass, `complexity_gate` fail on pre-existing functions (`parseModelResponse` 16, `runBSaveImproved` 27, …). `gatherStagedDiff` is not in `new_violations`. Override: not fixing unrelated complexity on this diagnosis. User override not obtained — recorded as pre-existing, out of scope.
