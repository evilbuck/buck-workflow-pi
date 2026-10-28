## Plan Path Review: Phase 2 — Apply deletes

### Plan Source
- File: `.context/2026-10-26.git-cleanup-skill/phase-2-apply-deletes.md`
- Goal: Delete only names still classified `auto-delete` by a fresh classification.
- Baseline: `ce95571` (`feat(git-cleanup): add fail-closed classifier`); the phase changes are staged.

### Evidence Sources
- Git status: staged changes to `classify.ts`, `classify.test.ts`, and this review’s iteration artifact.
- Recent commits: `ce95571` is the classifier baseline.
- Modified files: `skills/git-cleanup/scripts/classify.ts`, `skills/git-cleanup/scripts/classify.test.ts`.
- Plan affected files verified: both listed phase files have staged changes.

### Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| Fresh classify; delete only requested/fresh `auto-delete` intersection | 🔄 partial | `classify.ts:293-303` reclassifies and refuses missing or non-`auto-delete` names; focused test run failed before exercising this behavior. |
| Refuse a name no longer marked `auto-delete` | 🔄 partial | Refusal branch at `classify.ts:300-303`; new test at `classify.test.ts:160-172` is blocked by the same fixture base-resolution failure. |
| Remove worktrees without force; skip branch deletion after failed removal | 🔄 partial | `classify.ts:309-314` uses `git worktree remove` and continues on failure; no test for failed removal. |
| Select `-d` for ancestor tips and `-D` only for fresh `auto-delete` tips | 🔄 partial | `classify.ts:316-319`; no passing apply test verifies the deletion modes. |
| Unique `.context` remains `ask` and is not removed | 🔄 partial | New fixture at `classify.test.ts:174-195`; blocked by base-resolution failure. |
| Dirty/untracked porcelain is preserved; no `--force` | 🔄 partial | Dirty guard at `classify.ts:305-307`; new test checks a dirty branch and argv at `classify.test.ts:160-172`, but does not pass. |
| Prune only registrations already marked prunable; never delete a directory | 🔄 partial | `classify.ts:321-322` gates prune on fresh prunable entries; no apply-specific prune regression passed. |
| Current checkout and integration branch remain skipped | 🔄 partial | Fresh disposition guard at `classify.ts:300-303`; new test is blocked before assertion. |
| No network write, reflog expiry, GC, or push | ⚠️ not-verifiable | Source inspection shows fresh classify invokes fetch and apply uses local worktree/branch commands; no passing command-trace test verifies the complete apply argv. |
| Verification | ❌ missing | `npm run guardrails:check` failed required unit-test and global-ratchet gates; it also reported required complexity failure. Focused run: 27 of 28 tests failed with `No base found`. |

### Review Axes
- Spec axis worst finding: Required verification fails; apply behavior remains unverified.
- Standards axis worst finding: `apply` has complexity 15, exceeding the guardrails limit of 10. Sequential standards pass; no background task dispatcher was available.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: partial.
- User goal: partially met — apply logic exists, but the required test suite and durable contract fail.
- Scope adhered: yes; only the two phase-listed implementation files changed.
- Out-of-scope changes: none.

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: **fail**
- Gates: `unit_test_gate=fail`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=fail`, `complexity_gate=fail`.

### User Goal Analysis
- Goal: “Delete only the fresh proven-landed clean set, and refuse a stale name, a failed worktree remove, and `--force`.”
- Met: Fresh classification and explicit stale-name refusal are implemented.
- Partial: Worktree removal and branch-deletion safeguards exist, but their apply-path tests did not pass.
- Missing: Passing verification for apply, failed worktree removal, prunable cleanup, and deletion-mode selection.
- Verdict: partially met.

### Documentation Impact
- No documentation impact.
- Recommended: none.

### How-to Impact
- No how-to impact.
- Recommended: none.

### Issue Classification
- In-plan issues (implementation defects → `/b-iterate`):
  1. Fixture classifier tests fail base resolution, blocking verification of the apply path.
  2. `apply` exceeds the required complexity ceiling.
- Out-of-plan issues: none.

### Verdict
**Needs work** — required gates fail and the apply path is not verified.

### Recommended Next Step
`/b-iterate`, then re-run `/b-review` against the phase file. Iteration artifact: `.context/2026-10-26.git-cleanup-skill/iterate-git-cleanup.md`. All assignment files were staged.
