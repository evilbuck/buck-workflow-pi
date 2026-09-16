---
status: completed
date: 2026-09-16
updated: 2026-09-16
subject: 2026-09-12.code-review-iteration-extension
topics: [review, iteration, false-green, resume, fixer-checkpoint, model-routing, fingerprint]
informs: []
addresses: brainstorm-code-review-iteration-extension.md
completed: 2026-09-16
from_review: b-review
---

# Iteration: code-review-iteration-extension

## Source
- Reviewed after: `/b-review` (2026-09-16, committed branch `feat/code-reviewer-extension`, delta `origin/master..HEAD` = `c70e853` + `b63e2d4`)
- Plan: `brainstorm-code-review-iteration-extension.md` (brainstorm acting as acceptance contract; no `plan-*.md`)
- Spec: none
- Note: `review-2026-09-12.md` reviewed the pre-commit working tree and passed; this iteration covers defects found in the committed state, cross-confirmed by a second standards-axis pass.

## Critical Issues

### 1. Unusable reviewer payload can terminalize the loop as `clean` (false green)
- **File**: `extensions/code-review-iteration/loop.ts:283-289` (`parseReviewerOutput`), `loop.ts:601-607` (`resolveReviewedPass`)
- **Problem**: `parseReviewerOutput` returns `{ validation }` whenever `extractJson` yields any JSON object, even when `validateFindingsPayload` returned a non-empty `errors` array and zero surviving findings (e.g. `{}`, `{"findings": "none"}`, or all items invalid). `resolveReviewedPass` then sees `blocking.length === 0` and terminalizes `clean` with reason "reviewer reported no findings". Validation errors are stored in `review.json` but the run is green — the loop's stop-clean gate is bypassable by malformed model output.
- **Proposed fix**: In `parseReviewerOutput`, return `{ error }` when `validation.errors.length > 0` (or at minimum when `validation.findings.length === 0` with errors), so the pass fails as `failed` instead of declaring clean. Add a regression test: reviewer payload with unknown command id citation → run ends `failed`, not `clean`.

### 2. Catalog-preflight failure after resume leaves `state.json` stuck at `running`
- **File**: `extensions/code-review-iteration/loop.ts:574-576` (`initializeRun`)
- **Problem**: When catalog errors exist after `tryResume` has already persisted `status: running`, `initializeRun` returns `{ status: "failed" }` without calling `terminalize`/`saveState`. The run stays `running` on disk; `pruneRuntime` refuses to prune running runs (index.ts `pruneRuntime`), and a later `--resume` may adopt a catalog-failed run.
- **Proposed fix**: Route the catalog-failure path through `terminalResult(deps, ctx, "failed", …)` like every other terminal outcome. Add a test: seeded catalog error + existing run → `state.json` status `failed`.

## Warnings

### 1. Fixer-created new files never enter the pass checkpoint
- **File**: `extensions/code-review-iteration/loop.ts:437` + `extensions/code-review-iteration/git-ops.ts:193-208` (`checkpointCommit` uses `git add -u`, tracked-only)
- **Problem**: A fix that adds a new file (e.g. a new regression test) stays untracked: `checkpointCommit(cwd, [], …)` stages tracked changes only, so `checkpoint_commit` is null while checks pass, and the fresh Reviewer at the old HEAD never sees the fix.
- **Suggested approach**: Stage untracked non-ignored files in fixer-pass checkpoints (no user prompt mid-loop; record what was included in `fixer.json`), or have `runFixerPass` collect the fixer's changed paths via `git status --porcelain` and pass them as the selected list.

### 2. Resume fetch/rebase drift is not persisted, so the next resume is rejected
- **File**: `extensions/code-review-iteration/loop.ts:587-589` (`initializeRun` → `prepareBaseAndCheckpoint` → `saveState`)
- **Problem**: Every start (including resume) fetches and rebases; `saveState` afterwards does not refresh `state.last_head`/`worktree_fingerprint` (they update only inside the dirty-checkpoint branch and `runFixerPass`). If the run then dies before the next fixer pass, `validateResume` compares current post-rebase HEAD/fingerprint against stale values and refuses — the run caused its own unresumability.
- **Suggested approach**: After `prepareBaseAndCheckpoint` succeeds, update `state.last_head = resolveHead(cwd)` and `state.worktree_fingerprint = worktreeFingerprint(cwd)` before `saveState`.

### 3. `selectFixerModel` reviewer-exclusion and family diversity fail for `:thinking`-suffixed reviewer selectors
- **File**: `extensions/code-review-iteration/catalog.ts:268-271` (`selectionKey`), `catalog.ts:275-283` (`selectFixerModel` reviewer lookup)
- **Problem**: Seeded persona `default_model` values carry a thinking suffix (e.g. `zai/glm-5.3:high`), and `state.reviewer_model` keeps it. `entry.selector === reviewer` then never matches (catalog selectors are bare), so the exact-Reviewer exclusion and family-diversity sort keys silently degrade — the Reviewer's own model can be re-selected as Fixer without the `reusedReviewer` warning. `catalogEntryFor` in loop.ts already strips the suffix; the routing path does not.
- **Suggested approach**: Normalize the reviewer selector with the existing `thinkingFromSelector`/base-split logic before exclusion/family comparison in `selectFixerModel`.

### 4. `fixer.json` `changed_paths` contains finding ids, not paths
- **File**: `extensions/code-review-iteration/loop.ts:409` (`fixerRecord`)
- **Problem**: `changed_paths: dispositions.filter(valid).map(d => d.finding_id)` — the field name and the brainstorm's artifact contract ("per-finding verification disposition, changed paths, checks, and checkpoint commit") promise filesystem paths; it holds finding ids.
- **Suggested approach**: Compute changed paths from `git status --porcelain`/`diff --name-only` against the pre-pass HEAD and store those; keep finding ids in `dispositions`.

### 5. Un-catalogued explicit fixer model inherits another model's thinking table
- **File**: `extensions/code-review-iteration/loop.ts:362-374` (`chooseFixer`)
- **Problem**: `catalogEntryFor(entries, model) ?? selection.entry` — when `--fixer-model` names a model absent from the catalog, `entry` falls back to the auto-selection's entry and `thinkingFor(entry, required)` applies a different model's thinking levels.
- **Suggested approach**: When the explicit model has no catalog entry, pass `thinkingLevel: undefined` (session default) instead of another entry's table.

### 6. Guardrails deterministic contract fails on this delta (verification gate)
- **File**: repo-level (`guardrails.json` gates vs the extension delta)
- **Problem**: `/b-guardrails-check` on `origin/master..HEAD`: `patch_gate=fail` (patch coverage 83.75% < 90) and `complexity_gate=fail` (`findings.ts:validateReproduction` CCN 11, `loop.ts:runReviewerPass` CCN 11 > max 10). Hard-ceiling entries (`render.py:validate` 28, `b-save-improved` 27, `b-commit-improved` 16) pre-date this branch (master-side baseline drift), but the two CCN-11 functions and the patch-coverage gap are delta-attributable.
- **Suggested approach**: Add tests for uncovered changed lines (focus: `loop.ts` failure paths — they overlap with Critical 1/2 and Warning 2 above) and split `validateReproduction`/`runReviewerPass` into smaller functions. Do not re-baseline without explicit approval.

### 7. `sanitizedEnv` denylist misses process-injection variables
- **File**: `extensions/code-review-iteration/policy.ts:235-238`
- **Problem**: `extraEnv` filtering blocks credential-like names only; `NODE_OPTIONS`, `LD_PRELOAD`, `BASH_ENV` would be copied from the host if a policy author lists them. Exploitable only by the policy author (trusted file), but the contract says "supplies a sanitized environment".
- **Suggested approach**: Extend the deny regex to loader/injection classes (`NODE_OPTIONS`, `LD_*`, `BASH_ENV`, `ENV`, `PYTHONPATH`, `PERL5OPT`, …) or invert to a strict allowlist.

### 8. Small fidelity/robustness nits in check runner, stream cap, and model record
- **File**: `extensions/code-review-iteration/index.ts:299-305` (`runChecks`), `policy.ts:241-260` (`attachCappedStream`), `loop.ts:241-249` (`reviewRecord`)
- **Problem**: (a) `runChecks` splits `test_cmd` on whitespace and would mis-execute shell-syntax commands, and uses only the first ecosystem command; (b) `attachCappedStream` caps by `text.length` (chars) against `max_output_bytes` (bytes) — multibyte output can exceed the documented cap; (c) `requested_model`/`effective_model` (and temperatures) are always identical — the brainstorm's requested-vs-effective distinction (provider-side omission tracking) is not realized.
- **Suggested approach**: (a) skip shell-syntax check commands with a warning, same filter as `checkContractCommands`; (b) cap on `buf.length` bytes; (c) either track provider omissions from the session result or drop the duplicated requested/effective fields to one honest field.

## Known from prior review (not re-litigated)
- 19 non-null assertions post-`initializeRun` → discriminated prepared-context type (standards agent re-flagged; already the recorded fix direction from 2026-09-12).
- `catalogAllows` vs `tierAtLeast`, local `RATING_ORDER`, inlined blocking predicate, `state*` one-line wrappers.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same subject (the brainstorm remains the acceptance contract).
For larger rework, use `/b-build` or `/b-build-hard`.

## Resolution (2026-09-16, `/b-iterate`)

All Critical and Warning items fixed in `extensions/code-review-iteration/`; two latent defects found and fixed along the way:

- **C1** `parseReviewerOutput` now returns `error` when validation reports any errors — invalid payloads can no longer terminalize `clean`.
- **C2** catalog-preflight failure routes through `terminalResult`, so a resumed run is `failed` on disk, not stuck `running`.
- **W1** fixer pass stages files created during the session (pre-post untracked diff) and records real paths in `changed_paths` via `changedPathsSince` (**W4**).
- **W2** `initializeRun` persists post-rebase `last_head`/`worktree_fingerprint` before `saveState`; `terminalResult` refreshes the resume position after writing a non-clean terminal report (the report itself added untracked files inside the repo).
- **W3** `selectFixerModel` normalizes `:thinking`-suffixed reviewer selectors via `baseSelector` before exclusion/family comparison.
- **W5** uncatalogued explicit fixer models run at the session-default thinking level (no inherited table).
- **W6** `validateReproduction` and `runReviewerPass` split below CCN 10; failure-path tests added; patch coverage 91.97% (was 83.75%).
- **W7** `sanitizedEnv` denies loader/injection classes (`NODE_OPTIONS`, `LD_*`, `BASH_ENV`, `PYTHON*`, `GIT_*`, …) in addition to credential-like names.
- **W8** `runChecks` reuses `checkContractCommands` (shell-syntax skipped with warning, no whitespace-split execution); `attachCappedStream` caps by bytes; duplicated `effective_model`/`effective_temperature` dropped from `PassReviewRecord`.
- **Found A** `worktreeFingerprint` pinned `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` on `git stash create` — stash shas embedded wall-clock time, making resume validation time-sensitive (flaky false rejections).
- **Found B** dirty-start checkpoint moved **before** fetch/rebase in `prepareBaseAndCheckpoint` — with an autostash, a rebase conflict + `--continue` left the autostash reapply conflict (`UU` + markers) in the tree, which the checkpoint would then commit.

Verification: 129/129 extension tests, 674/674 repo tests, no extension function above CCN 10, patch coverage 91.97% on `origin/master..HEAD`. Red/green confirmed for both Criticals against temporarily reverted code.
