---
date: 2026-07-26
domains: [implementation, skill, docs, testing]
topics: [b-init-guardrails, b-guardrails-check, ratchet, detection, iteration, review, dispatch, lizard, diff-cover]
related:
  - .context/2026-07-26.b-init-guardrails/plan-b-init-guardrails.md
  - .context/2026-07-26.b-init-guardrails/iterate-b-init-guardrails.md
  - skills/b-init-guardrails/SKILL.md
  - skills/b-guardrails-check/SKILL.md
  - skills/b-init-guardrails/docs/agents-block.md
  - skills/b-init-guardrails/docs/ratchet-protocol.md
  - skills/b-init-guardrails/docs/tooling-matrix.md
  - skills/b-init-guardrails/scripts/detect-stack.ts
  - docs/buck-workflow.md
priority: high
status: completed
subject: 2026-07-26.b-init-guardrails
artifacts:
  - iterate-b-init-guardrails.md
  - draft-commit.md
---

# b-init-guardrails review iteration

## Summary

Closed three review-iteration passes against `plan-b-init-guardrails.md`.

Pass 1 fixed registration paths, ratchet ownership, baseline-aware complexity, recursive detection, lizard threshold, docs anchors, and install guidance.

Pass 2 fixed the remaining doc-only in-plan defect: managed-block dispatch ownership. The mainline agent owns OMP async `task` dispatch; `b-guardrails-check` remains measure-only. Also corrected the init skill verification bullet (tooling propose = Phase 2).

Pass 3 (this pass) fixed two **behavioral** in-plan defects found only by actually running the shipped commands against real repos (a live scratch-repo smoke test, not a documentation-only re-read):
- `lizard -C 10 -w --csv .` never excluded `node_modules`/`vendor`/`coverage`/`build`/etc despite `detect-stack.ts`'s own `IGNORED_DIRS` defining exactly that list. Reproduced: 19,111 CSV rows (mostly vendored code) vs 4 real rows once excluded.
- `diff-cover ... --fail-under=90` had no `--compare-branch`, defaulting to `origin/main` and hard-crashing on any repo without that exact remote/branch — reproduced in buck-workflow-pi itself (default branch `master`).

Both were fixed in parallel by two subagents (`FixLizardExclude`, `FixDiffCoverCompareBranch`) with non-overlapping file/function contracts, then independently re-verified against this repo and fresh scratch repos.

## Decisions

- Keep `b-guardrails-check` strictly read-only. It reports complete `ratchet_update` data; `/b-init-guardrails` refresh or the mainline agent applies approved updates at coherent points.
- Complexity gates are baseline-aware: unchanged brownfield hotspots pass with burn-down reporting; new/worsened non-baseline violations fail.
- Default lizard command is `lizard -C 10 -w --csv <excludes> .`; hard ceiling 15 is verdict logic, not the lizard warn flag alone. Excludes are derived from `detect-stack.ts`'s `IGNORED_DIRS` (single source of truth), spelled out literally in every doc occurrence for copy-paste ergonomics.
- Patch-gate `diff-cover` invocations always carry an explicit `--compare-branch=<git_compare_branch>`, resolved once per repo by a new pure, local-only `detectGitCompareBranch()` (checks `git symbolic-ref refs/remotes/origin/HEAD`, falls back to probing `origin/main`/`origin/master`/`origin/trunk`, else `null`). `git_compare_branch: null` skips the patch gate — same rule as the existing "no git → patch gate skipped" behavior.
- New `configured_not_installed: string[]` field surfaces manifest-declared-but-not-yet-installed tools across all detectors (TS/Python/Shell/JVM `firstAvailable` + each `detectSimple` ecosystem) without changing `test_runner` selection, so Phase 2 tooling proposals can offer install commands instead of silently substituting an unrelated fallback runner.
- Detection walks the tree (ignoring generated/vendor dirs), records nested Python/Shell signals, prefers local bins, and branches JVM/Xcode signals.
- Prompt wrappers use repo-root `skills/...` paths.
- **Dispatch owner = caller/managed block, never the check skill.** OMP async path is an explicit background `task`; bare `/b-guardrails-check` is blocking.

## Files Modified (cumulative across all 3 passes)

- `prompts/b-init-guardrails.md`, `prompts/b-guardrails-check.md`
- `skills/b-init-guardrails/SKILL.md`
- `skills/b-init-guardrails/docs/ratchet-protocol.md`
- `skills/b-init-guardrails/docs/tooling-matrix.md`
- `skills/b-init-guardrails/docs/agents-block.md`
- `skills/b-init-guardrails/scripts/detect-stack.ts`
- `skills/b-guardrails-check/SKILL.md`
- `docs/buck-workflow.md`
- `.context/backlog/todo.md`, `.context/backlog/items/b-init-guardrails.md`
- `.context/2026-07-26.b-init-guardrails/iterate-b-init-guardrails.md`, `draft-commit.md`

## Verification

- Detection: this repo → `typescript`/`python`/`shell`, runner `vitest`, `complexity_cmd` carries all 12 `-x "*/<dir>/*"` excludes, `git_compare_branch: "origin/master"` (this repo's real default branch — confirmed via `git remote show`, no network fetch needed since the ref is already local).
- Live scratch-repo smoke test (real vitest + lizard + diff-cover installed in a throwaway venv): ratchet asymmetry (improve → baseline raises; regress → fails, baseline unchanged) reproduced exactly per `ratchet-protocol.md`'s spec; patch gate isolates a newly-added uncovered function and fails at 33% once given a valid compare target; managed-block insert/refresh is idempotent (single BEGIN/END pair, hand-authored content survives); OMP async `task` dispatch is genuinely non-blocking (continued other work while a background verdict job ran, it auto-delivered).
- Post-fix re-verification (independent of the two fix subagents' own claims): grep confirms zero bare `lizard -C 10 -w --csv .` and zero bare `diff-cover ... --fail-under=` (without `--compare-branch=`) anywhere in either skill; `bun skills/b-init-guardrails/scripts/detect-stack.ts` runs clean; `ratchet-protocol.md` re-read in full — no duplication from the two subagents' concurrent edits (one subagent self-caught and corrected a stale-line-number collision before yielding).
- Empty-dir detection: no ecosystems; universal tools still reported `false`.
- Prompt paths + command symlinks OK. Docs QR anchors present for both skills.

## Next

Run `/b-review` against `.context/2026-07-26.b-init-guardrails/plan-b-init-guardrails.md` (pass 3 re-review), then `/b-save`, then `/b-commit` if review passes.
