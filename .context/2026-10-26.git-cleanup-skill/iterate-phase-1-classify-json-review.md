---
status: completed
date: 2026-10-26
updated: 2026-10-26
subject: 2026-10-26.git-cleanup-skill
topics: [review, iteration, git-cleanup]
informs: []
addresses: phase-1-classify-json.md
completed: 2026-10-26
from_review: b-review
---

# Iteration: Phase 1 classifier JSON

## Source

- Reviewed after: `/b-build-hard`.
- Phase: `phase-1-classify-json.md`.
- Parent plan: `plan-git-cleanup.md`.
- Baseline: `5197bfde8a1e110286c5470ae00abd2bfeff7b7c`, plus the current staged classifier and tests. No classifier changes are committed at this baseline.
- Scope: Phase 1 only. Apply, wrappers, redirects, and public documentation remain later-phase deliverables; they were not judged missing merely because those phases are unfinished.
- Supervisor-supplied SQL recall treated as reference only; no SQL call made.

## Critical Issues

### 1. Unrecognized merge-tree records after the separator fail open

- **File**: `skills/git-cleanup/scripts/classify.ts:52-67`
- **Problem**: `containment()` stops parsing at the first empty NUL record (line 59), discarding all subsequent structured merge information. It does not fulfill the explicit criterion that an unrecognized `-z` record makes containment false. A disposable Git wrapper returned a valid existing tree followed by `NUL NUL unrecognized-record NUL`; the real classifier returned `contained: true` and `disposition: auto-delete` for an otherwise eligible branch. No deletion was executed. This is a High in-plan defect in the proof consumed by the later delete phase.
- **Proposed fix**: Parse the entire documented `merge-tree --write-tree -z` output, including structured information records after the unmerged-entry separator. Validate record boundaries, counts, and recognized record types; collect every conflict path; reject malformed, truncated, or unknown records with `contained: false`. Do not inspect human-readable `Auto-merging` prose. Preserve valid clean-merge and context-only-conflict behavior. Add consumer-visible regression fixtures for malformed trailing records and unknown record types.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/git-cleanup/scripts/classify.ts:52-67. Re-review this finding with Jev.

### 2. The required checkpoint fails the repository skill-catalog invariant

- **File**: `skills/git-cleanup/scripts/classify.ts`
- **Problem**: Creating `skills/git-cleanup/` without `skills/git-cleanup/SKILL.md` breaks the existing direct-root-skill catalog invariant (`scripts/skill-frontmatter.test.ts:83-136`). `npm run guardrails:check` exits 1: required `unit_test_gate=fail`, required `global_ratchet=fail`, and `coverage command failed (exit 1)`. The captured failure explicitly reports ENOENT for the missing skill file; the runner's retained tail is labeled `[1/5]`. Coverage is unavailable, not a measured coverage regression. Phase 1 explicitly requires a passing checkpoint, so this is an in-plan integration/verification defect even though the complete skill was scheduled for Phase 3.
- **Proposed fix**: Resolve the checkpoint/phase-boundary conflict so a complete canonical skill exists when this new root skill directory is checkpointed; if that requires moving accepted Phase 3 work forward, record the scope adjustment explicitly. Do not add a placeholder skill, weaken the catalog tests, change enforcement, or invent coverage. If the skill must remain deferred, only an explicit user gate override can authorize that checkpoint; none was supplied for this review. Re-run the authoritative guardrails command after correction.

## Warnings

### 1. A historical completed subject labels unique implementation code finished

- **File**: `skills/git-cleanup/scripts/classify.ts:104-117`
- **Problem**: The script scans every subject/plan in the tip tree, sets `completed` if any contains `status: completed`, then returns `finished` without checking for unique code. A temporary repo with an inherited completed subject, an active feature subject, and a new `unique.ts` commit returned `state: finished`, `contained: false`, `disposition: ask`. The accepted state rule requires no unique code for the completed-subject alternative. The branch remains protected from auto-delete, but its ask-list label misleads the user's keep/delete decision. Medium, in-plan.
- **Suggested approach**: Resolve the branch-relevant subject and frontmatter rather than treating any historical document/body match as authoritative. Evaluate unique code before allowing completed-subject status to imply `finished`; active unique implementation must remain `building`. Cover the reproduced historical-completed/active-feature transition.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/git-cleanup/scripts/classify.ts:104-117. Re-review this finding with Jev.

### 2. Plan-title fallback only considers files changed by the final commit

- **File**: `skills/git-cleanup/scripts/classify.ts:82-93`
- **Problem**: `git show --pretty=format: --name-only <tip>` lists the final commit's changed files, not plans present in the branch tree. With failing `gh`, a branch that committed `# Intended feature description` in its plan and then committed source returned `description_source: commit_subject` and `description: implement feature code`. The committed plan still exists and must precede commit subject in the accepted fallback order. Medium, in-plan.
- **Suggested approach**: Find the relevant plan in the tip tree (or the relevant worktree context as specified), read its H1, and use the commit-subject fallback only when no usable relevant plan exists. Add a regression with a plan commit followed by an implementation commit and unavailable PR metadata.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/git-cleanup/scripts/classify.ts:82-93. Re-review this finding with Jev.

### 3. Newline worktree paths are truncated by line-based porcelain parsing

- **File**: `skills/git-cleanup/scripts/classify.ts:37-41`
- **Problem**: Worktree paths are parsed by splitting on newlines, while the inventory command at line 229 does not request NUL-delimited porcelain. A real registered worktree at `<temporary-repo>/checkout\nline` was reported with path `<temporary-repo>/checkout`. The reproduced result was conservatively `ask`, but it did not identify the registered worktree correctly and performed status/proof commands at the wrong path. The contract includes every registered worktree without a pathname restriction. Medium, in-plan.
- **Suggested approach**: Use `git worktree list --porcelain -z` and parse its NUL-delimited fields/record separators without trimming or splitting pathname bytes. Exercise a real worktree containing a newline and assert the exact returned path and classification.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/git-cleanup/scripts/classify.ts:37-41. Re-review this finding with Jev.

### 4. The promised permanent fixture set is incomplete

- **File**: `skills/git-cleanup/scripts/classify.test.ts:43-206`
- **Problem**: The nine tests pass, but there is no dedicated eligible ancestor, clean single-commit squash, cherry-pick-equivalent, non-current unique-code branch, or prunable/missing-gitdir fixture as required by the phase's Verification section. The dirty test combines tracked and untracked changes, so it does not independently prove that untracked-only state blocks deletion; ignored-file behavior also is not exercised. A live missing-gitdir smoke helps current evidence but does not supply the promised isolated regression fixture. Medium, in-plan verification gap.
- **Suggested approach**: Add deterministic temp-repo scenarios for these distinct proof and refusal boundaries, asserting consumer-visible disposition/evidence rather than incidental wording or counts. Keep the required phase boundaries: no permanent apply-refusal test is requested in Phase 1. Add the parser/state/description/path regressions above while correcting those defects.


- **Jev failure**: Jev failed: missing, unreadable, or oversized file skills/git-cleanup/scripts/classify.test.ts:43-206. Re-review this finding with Jev.

## Plan Path Review

### Plan Source and Evidence Sources

- Goal: classify every local branch and registered worktree as `skip`, `auto-delete`, or `ask`, and delete nothing.
- User goal: safely distinguish landed local work, including rewritten history, and give useful descriptions and lifecycle labels for the remainder.
- Initial Git status: staged new `classify.ts`, `classify.test.ts`, build notes, and draft commit; pre-existing unstaged backlog edits and untracked subject/backlog artifacts. Those pre-existing changes are not review-owned and must not be staged by this assignment.
- Recent baseline commit: `5197bfd` (`Merge branch 'fix/buck-loop-jev-halt'`); no classifier commit yet.
- Affected source files inspected in full: `skills/git-cleanup/scripts/classify.ts:1-249`, `skills/git-cleanup/scripts/classify.test.ts:1-206`.
- Parent decision closure inspected: `plan-git-cleanup.md:32-131`. A-1 through A-6 remain settled; no deferred/blocking assumption was assigned here. This review checks implementation, not the selected containment design.

### Completion Matrix

| Deliverable | Status | Direct current-state evidence |
|---|---|---|
| One JSON document, exit 0, no delete path; reject `--apply` | complete | Repository CLI produced valid JSON; full source inspection finds only read/proof commands plus fetch; disposable CLI `--apply` returned exit 1, empty stdout, usage error. |
| Base precedence and no-base refusal (A-1) | complete | `classify.ts:44-50`; tests for origin/HEAD, local master/main fallback, and no-base refusal passed. |
| Fetch first; argv only; failure does not imply remote-gone | complete | `classify.ts:8-16,96-102,222-226`; failed-fetch upstream test passed. No-upstream `remote: null` follows the explicit JSON contract at phase line 96. |
| Every registered branch/worktree, regardless of parent (A-6) | partial | Repository smoke inventoried 15 items including external/prunable registrations; newline path was truncated (warning 3). |
| A-2 containment; fail closed on unknown records | partial | Squash and conflict fixtures pass; injected unrecognized trailing record returned `contained: true`, `auto-delete` (critical issue 1). |
| Cherry is evidence only | complete | `classify.ts:128-135,176-180`; two-commit squash test returned `auto-delete` with `cherry.plus: 2`. |
| Preserve unique context (A-3) | complete | Unique-context test returned `finished`/`ask`; context-only-conflict test returned contained code but `ask`. |
| Source conflict blocks auto-delete | complete | Source-conflict fixture returned `contained: false`, `ask`, conflict path `app.ts`. Exact `src/app.ts` fixture remains part of the coverage gap. |
| Dirty/untracked status blocks auto-delete; ignored files hidden | partial | Combined tracked/untracked test passed; `classify.ts:120-125` explicitly includes normal untracked files without `--ignored`. Untracked-only and ignored-file regression cases are absent. |
| Current, integration, main worktree skip | complete | `classify.ts:137-141`; current/integration fixture passed; real current checkout returned `skip_reason: current`. Main-path protection is directly present at line 140. |
| Missing-gitdir prunable entries ask, no directory deletion | complete | Real smoke returned four `/tmp/phase8-omp/*` prunable entries as `ask`, `contained: false`; no removal path exists. Permanent isolated fixture still missing. |
| State and description semantics; failed gh yields null | partial | Disposable failing-gh scenario returned `pr: null`, but unique code was `finished` and a present plan title lost to commit subject (warnings 1–2). |
| Required permanent fixtures | partial | 9/9 current tests pass; the named coverage gaps remain (warning 4). |
| Required deterministic checkpoint | missing | Durable v2 runner exits 1; `unit_test_gate` and `global_ratchet` fail (critical issue 2). |
| Repository smoke | complete | `bun skills/git-cleanup/scripts/classify.ts` produced 15 items; `feat/git-cleanup-skill` is `skip`, dirty true; fetch succeeded. No `--apply` used in this repo. |
| Blocking/deferred assumptions | complete | Parent ledger marks A-1–A-6 validated, blocking false; phase assigns no deferred assumption. Implementation deviations are listed above, not a reopening of those decisions. |
| Phase rollback/fallback remains available | complete | Classifier contains no branch/worktree deletion, prune, reflog-expiry, GC, or push path. Phase 1 rollback is simply not applying deletes; Phase 2 deletion recovery/race proof and Phase 3 redirect recovery are not judged here. |
| Scope adherence | complete | Reviewed implementation changes are the phase's two named source files; no apply implementation, remote deletion, or managed-skill changes found. |

### Review Axes

- Spec axis worst finding: **High — unknown trailing merge-tree records can still produce auto-delete**. Verdict input: Needs work.
- Standards axis worst finding: **High — incomplete validation of an external structured protocol before emitting a destructive eligibility result**, same source location as critical issue 1. Additional correctness observations: unsafe line-based pathname parsing and misleading metadata, detailed above. Verdict input: Needs work.
- Standards execution: explicitly scoped **second sequential pass**, because this harness exposes no background agent/task dispatch tool. No independent sub-agent result is claimed.
- Standards references loaded: `code-review-universal/reference/typescript.md`, `code-review-universal/reference/code-quality-universal.md`; diff-scoped smell subset: Long Method, Duplicate Code, Long Parameter List. No separate actionable smell-only finding: parameter density and short wrapper duplication did not justify unrelated refactoring. A local reuse search found no shared merge-tree parser; the neighboring rebase-conflict helper parses text conflict markers, not this binary protocol.
- Cross-axis ranking: none. Findings are not merged into one cross-axis severity order.

### Verification Status and Guardrails Verdict

- Goal achieved: partial. Inventory/no-delete surface works; proof and metadata correctness do not yet satisfy the phase.
- User goal: partially met for the Phase 1 portion; later deletion and skill UX are intentionally not claimed complete.
- Scope adhered: yes; no out-of-scope implementation changes found in the reviewed source set.
- `npx vitest run skills/git-cleanup/scripts/classify.test.ts --reporter=verbose`: **9 passed, 1 file passed**.
- Disposable CLI scenarios executed against real temp repos: historical-completed/unique-code label, plan-title precedence, malformed trailing merge-tree output through a Git executable wrapper, real newline worktree pathname, and apply usage rejection. All four defects reproduced as described. Temporary files removed after execution.
- Contract: **durable**, version **2**, status **fail**.
- Gates: `unit_test_gate=fail`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=fail`, `complexity_gate=pass`.
- Coverage command exit 1; `coverage.current=null`, baseline 84; patch coverage null. Complexity: 30 hotspots, baseline 30, no new violations or hard-ceiling violations.
- No gate was rerun merely to confirm this deterministic failure; the tree was not being edited by this review during the run.
- Active-goal extension: not applicable; discovered current-session state has no non-null goal.

### User Goal Analysis

- Met: read-only inventory, squash containment happy path, context preservation, ordinary dirty refusal, protected checkout skips.
- Partial: safe proof on unfamiliar protocol output, accurate lifecycle labels, description precedence, arbitrary registered worktree paths, complete fixture/gate evidence.
- Missing: passing required checkpoint. Delete/apply UX remains later-phase scope, not a Phase 1 defect.
- Verdict: **partially met**.

### Documentation Impact

No additional living-documentation impact for this source-only phase beyond the public skill/redirect/docs work already explicitly assigned to Phase 3. Do not create a parallel procedure or alter those docs as a review-only action.

### How-to Impact

No separate how-to required at this internal classifier checkpoint; the user-facing cleanup procedure remains Phase 3. No documentation/how-to concern is used as a correctness blocker here.

### Issue Classification and Verdict

- In-plan issues: **6** (two critical-section findings and four warning-section implementation/verification findings). All address the phase's proof, inventory, state/description, tests, or required checkpoint.
- Out-of-plan issues: **none**.
- Verdict: **Needs work**.

### Completion Audit

Concrete deliverables were taken from the assigned phase, mapped to current source/tests/CLI evidence above, and checked against the actual tree. CLI scope was exercised directly and the authoritative check contract was run. Passing test checkboxes were not substituted for proof; unknown protocol handling, incorrect metadata/path output, absent regression scenarios, and the failed checkpoint remain explicitly unachieved.

## Recommended Workflow

Start with `/b-iterate` for the in-plan defects above, then re-run `/b-review` against `phase-1-classify-json.md`. Complete this iteration artifact during iteration before returning to the supervisor; do not leave it active waiting for review/save. Resolve the catalog/phase-boundary conflict explicitly rather than silently expanding scope or suppressing the gate. No authority to advance loop state is exercised by this review.

## Iteration implementation evidence (2026-10-26)

- Critical 1: parse the entire merge-tree NUL document, including count/path/type/message records after the separator. Unknown stable types, malformed counts, missing fields, and truncated documents refuse containment. Structured conflict paths are checked alongside unmerged paths; human-readable message prose is opaque.
- Critical 2: move complete canonical `skills/git-cleanup/SKILL.md` authoring into this checkpoint, explicitly recorded in the phase file and `plan-phase-1-iteration.md`. No placeholder or catalog/test/enforcement exemption. Apply implementation remains Phase 2; wrappers, redirect, public docs, and interface verification remain Phase 3. The skill refuses to bypass an unavailable apply prerequisite.
- Warning 1: frontmatter-only status from branch-relevant changed subject artifacts; unique code blocks the completed-metadata alternative. Historical completed subjects no longer label the active unique-code fixture finished.
- Warning 2: discover the relevant plan in the branch tip tree, not just final-commit changes. The plan H1 wins after a subsequent code commit with failed gh.
- Warning 3: inventory uses NUL porcelain and preserves exact paths, including embedded newlines.
- Warning 4: added ancestor, single-squash, cherry-pick-equivalent, non-current unique-code, untracked-only, ignored, prunable, and newline fixtures, plus malformed structured-record and metadata regressions. Source conflict fixture now uses `src/app.ts`.

Verification: focused Vitest **30 passed** (24 classifier + 6 catalog); TypeScript check for both files exited 0. An isolated pre-fix classifier countercheck produced **8 failing regression assertions**, confirming the new tests detect the defects; the disposable countercheck's hardcoded expected total was 7 and therefore itself exited 1 after displaying those eight failures. Live checkout was not mutated.

Actual repository CLI: valid JSON, 15 items, fetch succeeded, current branch `skip` / `current`. Separate actual-CLI temporary-repository smoke: registered newline checkout outside the main repository's parent retained its exact path and classified as clean / contained / `auto-delete`; neither branch nor checkout was deleted. No apply invoked. Temporary runners and repositories removed.

Additional missing-gitdir boundary: a prunable ignored nested checkout whose directory still exists could silently fall back to the parent repository and return `auto-delete`. Actual CLI smoke and a new permanent regression reproduced that failure. All prunable registrations now refuse containment; the regression passed after the fix, and actual CLI smoke changed to `contained: false`, `disposition: ask`, retaining the branch.

Final authoritative `npm run guardrails:check`: **pass**, durable v2, exit 0. Unit gate passed; coverage **89.4%** against **84%** baseline; global ratchet, patch, and complexity gates passed; **no new complexity violations**. Functional and lint gates skipped/disabled. Patch coverage itself is null; no measured patch percentage is claimed. No enforcement or baseline changed. The earlier checkpoint was cancelled before the newly discovered gitdir fix; only this final post-fix verdict is completion evidence.

All six review findings and the missing-gitdir refusal boundary are resolved. Iteration is completed; supervisor owns re-review against `phase-1-classify-json.md`, documentation routing, save, commit, phase status, and loop routing.
