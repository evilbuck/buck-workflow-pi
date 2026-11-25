# Run

You are the run worker for one slice. Load this file and the run machine in [`stage-map.md`](stage-map.md). Do not load `SKILL.md`. Do not sequence other phases.

The brief names the subject, the slice, a start-stage hint, whether this is the final run, and the caps with their reconstructed counts. The hint loses when evidence disagrees. Take the run machine's first true row. This file is the effect of those edges, not a second route.

## Effects

Dispatch one stage subagent at a time. Resolve every dispatch target through the stage map's resolution table and use its canonical stage brief in [`stage-map.md`](stage-map.md). You are not that stage's worker.

Stage workers implement only this slice. Review workers stay read-only except the review artifacts their skill writes. If source files changed under a review worker, reject the result and re-dispatch.

**Review retention effect.** After every verdict, retain a `review` artifact through `workflow_state` and read back its exact revision. Record the subject, slice, cycle, baseline commit, implementation fingerprint, verdict, gate evidence, docs and how-to impact, out-of-plan findings, and the exact iterate revision and its `recommended_workflow` when there are in-plan issues. Verify the iterate revision and its route before using it. Independently recheck the cited gates and implementation. Missing or mismatched proof cannot advance the run.

Compute the implementation fingerprint from a sorted, unambiguous manifest of in-scope paths, Git modes, and object IDs for the current candidate. Include untracked additions and an explicit marker for tracked deletions. Use the Git mode that would be committed (including executable mode), hash a symlink's target text without following it, and use the commit ID for a gitlink. For regular files hash the bytes Git would stage for that path. A temporary index seeded from the review baseline and populated with only the selected implementation can supply these entries without writing to the live index. Exclude review artifacts and generated bookkeeping. Use the same recipe before and after review and on resume.

**Repair effect.** Record the dispatch keyed by the failing review revision before running the repair worker. Pass the exact review and iterate revisions and the in-plan findings to all three repair routes. On verified repair, confirm the referred iterate artifact is completed (or complete it through the adapter for build routes), then re-review the current candidate. A current passing review takes precedence over any older active iterate artifact.

**Finalize effect.** Read the canonical acceptance result. Set an unphased plan to `status: completed` only for a non-empty, fully verified checklist; never check a box on the builder's behalf. Finalize phase status before the phase's commit. Save. On a final plan-backed run, inspect the lifecycle and run `close-verified` if closure is pending, then reinspect and require `effectiveState: completed`, `verifiedClosed: true`, and an empty blocker list before preparing the commit — a saved artifact is not closure proof:

```bash
bun skills/_shared/scripts/subject-lifecycle.ts inspect --subject .context/<folder> --json
bun skills/_shared/scripts/subject-lifecycle.ts close-verified --subject .context/<folder> --json
```

Pass the `.context/<folder>` path; a bare folder name does not resolve. Do not edit the subject index yourself. Intermediate phases leave the subject open; quick-fix runs have no closeout edge. Return actual blockers, never a successful completion with a blocker list.

**Commit preparation effect.** After verifying acceptance, save, and any required closure, select the exact attributable source and required repo-projected records. A declared path does not confer ownership of every hunk. If ownership is ambiguous, stop before staging. On other adapters, use retained revision references for records.

Prepare the candidate tree in a disposable detached worktree at the current parent. Populate its index and worktree with only the verified candidate, including deletions and modes. Capture the target branch, the exact candidate paths, and the live index entries at those paths. A candidate path may have the parent's index entry or the candidate's index entry. If it has any other staged entry, stop before committing because publishing the candidate would overwrite that staging. Leave unrelated entries alone.

Before dispatch, retain and read back a slice-specific commit checkpoint through `workflow_state`: subject and slice identity, review and acceptance/save/closure revisions as applicable, branch, expected parent and tree, candidate paths, and their captured live index entries. Keep the checkpoint outside the candidate tree. Give that checkpoint and the detached worktree to the commit worker. It commits and verifies there with normal hooks. A hook-modified tree stays detached, and the worker returns the mismatch without advancing the branch.

After the worker returns a verified single-parent commit, re-read the checkpoint and verify the commit independently. Retain its SHA before publishing it. Confirm that the original worktree still has the expected branch and that the candidate paths' live index entries still match the snapshot. Keep the checkout under the supervisor's exclusive control during promotion and reconciliation. Advance the branch from the expected parent to the verified SHA with a compare-and-swap ref update. If the branch moved, stop. Compare the live index entries at the candidate paths with the verified tree. Restore only entries that differ, using `git --literal-pathspecs restore --staged --no-overlay --source=<verified-sha> -- <paths>`. No-overlay removes entries for committed deletions. Skip the command when every entry already matches, including paths already absent from both the index and tree. Preserve all worktree bytes and unrelated staged entries. Verify the committed paths' index entries match the commit and mark reconciliation complete.

If interrupted after promotion, resume reconciliation before running another stage. Require the expected branch and verified tip, and compare the candidate paths' index entries with the captured and intended entries. If they still match the capture, reconcile. If they already match the intended entries, verify and record completion. Otherwise leave the index intact and report the conflicting paths. A checkpoint without completed reconciliation cannot authorize the next run. Once reconciled, the exact commit remains valid anywhere in reachable history.

## Verify before return

- The retained `review` revision reads back and its fingerprint still matches the slice.
- In-plan issues are gone, or the run is blocked at a reconstructed cap.
- The save evidence the save skill names was re-read.
- Acceptance and phase status were finalized per the finalize effect, with closure verified on a final plan-backed run.
- `git` shows the new commit as the current tip with the prepared parent and tree, and the retained checkpoint confirms live-index reconciliation.
- Return the commit SHA, retained revision ids, artifact paths, out-of-plan findings, and any blocker.

A subagent summary is not evidence. A blocked run does not commit.
