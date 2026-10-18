---
status: completed
date: 2026-07-26
updated: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [review, iteration, guardrails, lizard, diff-cover, complexity, patch-gate]
informs: []
addresses: plan-b-init-guardrails.md
completed: 2026-07-26
from_review: b-review
---

# Iteration: b-init-guardrails (pass 3)

## Source

- Reviewed after: two prior `/b-iterate` passes (both marked `status: completed`) that fixed dispatch-ownership wording and the Phase-2 verification bullet.
- Plan: `plan-b-init-guardrails.md` / `plan-b-init-guardrails-phases.md` (all 5 phases marked completed).
- Scope: full-plan re-review, including **live execution** of plan Verification items 1, 4, 5, 6, 7 against a real scratch git repo (TS/vitest) — not just document inspection. Items 2/3 (greenfield/brownfield init) are covered end-to-end by the same scratch-repo run (detect → measure → write baseline → confirm no day-one failure).

Both issues below are **newly discovered by actually running the shipped commands**, not by re-reading prose that was already fixed in passes 1–2.

## Critical Issues

### 1. `lizard` complexity command never excludes `node_modules`/`vendor`/`coverage`/`build`

- **Files**: `skills/b-init-guardrails/scripts/detect-stack.ts` (`LIZARD_CMD`, line 68), `skills/b-init-guardrails/docs/ratchet-protocol.md` (schema example + Implementation Notes), `skills/b-init-guardrails/docs/tooling-matrix.md` (every "Fallback" line, ~12 occurrences), `skills/b-init-guardrails/SKILL.md` (Phase 2 proposal text, line 73)
- **Problem**: Every recorded/proposed complexity command is the bare `lizard -C 10 -w --csv .` with no `--exclude`/`-x` flags. `detect-stack.ts` already defines `IGNORED_DIRS` (`node_modules`, `vendor`, `coverage`, `dist`, `build`, `.venv`, `target`, `.next`, `.nuxt`, `.turbo`, `.git`, `.context`) for its own manifest walk, but that list is never wired into `LIZARD_CMD`. Reproduced live: in a minimal scratch TS repo (`vitest` + one real source file with 2 real functions), `lizard -C 10 -w --csv .` emitted **19,111 CSV rows** — almost entirely `node_modules` (color-convert, ansi-styles, emoji-regex, etc.) and the generated `coverage/lcov-report/*.js` — versus **4 rows** for the actual project code once `-x "./node_modules/*" -x "./coverage/*"` was added by hand. This directly contradicts the plan's own risk mitigation ("`complexity_baseline_file`... offers to split... above ~200 entries") — vendored code alone blows past that threshold on virtually any real npm/pip project, so brownfield baselines and burn-down tracking would be dominated by third-party code no one can or should "burn down." This is the same category of bug the plan's Risk table exists to prevent, just not caught because the recorded command was never actually run against a populated repo during prior review passes.
- **Proposed fix**: Build `LIZARD_CMD` (and every doc occurrence) from `IGNORED_DIRS`, e.g. `lizard -C 10 -w --csv $(for d in "${IGNORED_DIRS[@]}"; do printf -- '-x "./%s/*" ' "$d"; done) .` or the lizard-native equivalent. Update `detect-stack.ts`'s `LIZARD_CMD` constant, and every `lizard -C 10 -w --csv .` occurrence in `ratchet-protocol.md`, `tooling-matrix.md`, and `SKILL.md` to the excluding form. Keep the exclude list in sync with `IGNORED_DIRS` (single source of truth — reference it, don't hand-duplicate the directory names in prose).

### 2. `diff-cover` patch-gate command has no `--compare-branch`, defaults to `origin/main`, fails outright on non-`main` default branches

- **Files**: `skills/b-init-guardrails/SKILL.md` (Phase 2 proposal, line 76), `skills/b-init-guardrails/docs/ratchet-protocol.md` (Patch Gate section, "How it works" step 2), `skills/b-init-guardrails/docs/tooling-matrix.md` (patch-gate command references)
- **Problem**: The shipped command is `diff-cover coverage/lcov.info --fail-under=90` with no `--compare-branch`. `diff-cover`'s default compare target is `origin/main`. Reproduced live: running this exact command in the scratch repo raised `ValueError: Could not find the branch to compare to. Does 'origin/main' exist?` — a hard crash, not a coverage failure. This is not a scratch-repo artifact: **this very repo's own default branch is `master`** (`git remote show` → `HEAD branch: master`), so the documented command would fail identically here. Any repo using `master`, `trunk`, a differently-named remote, or no remote at all gets a crash instead of a patch-gate verdict — the opposite of "day-one brownfield enforcement," which is the plan's central selling point. Once given a valid comparison target (`--compare-branch=HEAD~1` in the smoke test), the underlying gate logic is correct: it isolated the new uncovered `multiply()` function, computed 33% patch coverage, and failed the ≥90% gate as designed — so the fix is narrow (comparison-target resolution), not a redesign.
- **Proposed fix**: Have Phase 1/2 detect the actual default branch (e.g. `git rev-parse --abbrev-ref origin/HEAD` or `git symbolic-ref refs/remotes/origin/HEAD`, falling back to comparing against the last commit / a user-supplied branch when no remote exists) and record the resolved `--compare-branch` value in `guardrails.json` (or document it as a per-repo `diff-cover` flag the check skill must resolve at run time, not hard-code `origin/main`). Update the Phase 2 proposal text, `ratchet-protocol.md`, and `tooling-matrix.md` patch-gate command examples to show the resolved/parameterized form, and add a fallback note for non-git or remote-less repos (already partially covered by "Assumptions": "Non-git projects get global-ratchet only" — extend that note to cover git repos with a non-`main` default branch or no remote).

## Warnings

### 1. `detectTypeScript`/`detectPython`/`detectShell`/`detectJvm` silently downgrade to a fallback runner when the manifest-declared tool isn't yet installed

- **File**: `skills/b-init-guardrails/scripts/detect-stack.ts` (`firstAvailable`/`checkToolPresence`, lines 156–176; used by `detectTypeScript` line 209)
- **Problem**: `vitestConfigured` (declared in `package.json` devDependencies or a `vitest.config.*` file) is computed but discarded if the `vitest` binary isn't present in `node_modules/.bin` or on `PATH`. Reproduced live: a scratch repo with `vitest` declared in `package.json` but no `bun install` yet reported `test_runner: "node --test"` and `tools_installed.vitest: false`, contradicting the project's own manifest. After `bun install`, detection correctly reported `vitest`. This only matters in a pre-install state (fresh clone, CI before install step), and Phase 3 measurement requires the tool installed anyway — so it is not release-blocking, but it does contradict the plan's "detect and reuse existing project tooling" principle for that window. Not a regression from prior passes; newly observed while testing item 1's fix scope.
- **Suggested approach**: When a candidate is `*Configured` but not `checkToolPresence`, surface it distinctly (e.g. `configured_not_installed: true`) so Phase 2's tooling proposal can offer `bun install` / `pip install` rather than silently substituting an unrelated fallback runner.

### 2. (carried forward, unchanged) `detectSimple` still emits preferred runners without presence selection

- Same as previously reported — Ruby/PHP/Go/Rust/C++/Swift/C#/Elixir configs in `detectSimple` don't run `firstAvailable`. Optional polish, not required to close this pass.

## Notes (not iteration blockers)

- Plan Verification items 1, 4, 6, 7 (detection smoke, ratchet asymmetry both directions, OMP async dispatch, managed-block idempotency) were executed live against a scratch repo this pass and passed on their own logic once the two critical-issue commands above are corrected for exclusions/compare-branch. Items 2/3 (greenfield/brownfield init) are covered by the same run.
- Async dispatch (`task({...})`) was exercised for real: dispatched a background job, continued unrelated work (the idempotency test) while it ran, and the verdict auto-delivered without blocking — confirms the mechanism plan Verification item 6 requires.
- Prior critical/warning items from passes 1–2 (dispatch-ownership wording, Phase-2 verification bullet, prompt paths, ratchet ownership model, baseline-aware complexity, recursive detection in `detect-stack.ts`'s own walk, `lizard -C 10` threshold consistency, docs anchors, diff-cover install guidance) remain fixed — re-verified in this pass.
- Backlog item `.context/backlog/items/b-init-guardrails.md` and `todo.md` still say "review iteration in progress" / "review iteration pending" — update at `/b-save` closeout once this pass's fixes land and review passes clean.

## Resolution (2026-07-26)

Both Critical issues fixed via two parallel subagents (`FixLizardExclude`, `FixDiffCoverCompareBranch`), independently verified against this repo after landing:

1. **Critical #1 (lizard excludes)** — `detect-stack.ts`'s `LIZARD_CMD` now derives `-x "*/<dir>/*"` flags from the existing `IGNORED_DIRS` set (single source of truth). All bare `lizard -C 10 -w --csv .` occurrences replaced with the excluding form across `detect-stack.ts`, `ratchet-protocol.md` (schema example, field description, Implementation Notes), `tooling-matrix.md` (12 fallback lines + CI variant), and `SKILL.md` Phase 2. Verified: `bun skills/b-init-guardrails/scripts/detect-stack.ts` now emits `complexity_cmd` with all 12 excludes; grep confirms zero bare occurrences remain; ran the real resulting command against this repo (1,260 rows — sane, since this repo has no committed `node_modules`) and against a scratch repo with vendored `node_modules`/`coverage`/`dist` content (vendored functions fully excluded, only real project functions remained).
2. **Critical #2 (diff-cover compare-branch)** — added a pure, local-only `detectGitCompareBranch()` to `detect-stack.ts` (checks `git symbolic-ref refs/remotes/origin/HEAD`, falls back to probing `origin/main`/`origin/master`/`origin/trunk`, else `null`). New `git_compare_branch` field wired into the JSON output, `guardrails.json` schema (`ratchet-protocol.md`), `SKILL.md` Phase 1 display + Phase 2 proposal + Phase 3/4 write, and `b-guardrails-check/SKILL.md` Step 2 (uses the recorded field; `null` skips the patch gate, same as the existing non-git rule). Verified: this repo (default branch `master`) now resolves `git_compare_branch: "origin/master"` — confirmed the ref exists locally, `diff-cover --compare-branch` accepts it; a scratch repo with no `origin` remote resolved `null` without crashing; a scratch repo with a non-`main` default branch resolved via the candidate-probe fallback.

Both Warnings from this pass were also fixed by `FixLizardExclude` while touching the same detectors: `configured_not_installed: string[]` now surfaces manifest-declared-but-not-installed tools (TS/Python/Shell/JVM `firstAvailable` detectors, and each `detectSimple` ecosystem's single documented runner) without changing `test_runner` selection — Phase 2 tooling proposals can now offer install commands for a declared-but-missing tool instead of silently substituting an unrelated fallback.

## Recommended Workflow

Start with `/b-iterate` against this artifact (fix both Critical issues at minimum — they're the same root cause: shipped commands not validated against a real, non-trivial repo). Then re-run `/b-review` against `plan-b-init-guardrails.md`, re-executing the same live scratch-repo smoke test (detect → measure → lizard exclude check → diff-cover compare-branch check) rather than re-reading prose, since both defects were invisible to a documentation-only review.
