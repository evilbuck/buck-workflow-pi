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

Prepare the candidate tree against the current parent using a temporary index seeded from that parent's tree and containing only the candidate changes. Use an isolated commit facility only if it can consume that selection and preserve unrelated live-index and worktree entries. Otherwise use the live index only if every pre-staged change belongs to the verified candidate patch. If any staged path or hunk is outside the patch, stop before staging or dispatch. Stage the candidate and require the entire live index tree to equal the prepared tree. Do not stash, reset, clean, or override the protected-branch restriction.

Before dispatch, retain and read back a slice-specific commit checkpoint through `workflow_state`: exact subject and slice identity, current passing review and acceptance/save/closure evidence revisions as applicable, expected parent SHA, and expected tree OID. Store the checkpoint outside the candidate tree so it can describe that tree without a self-reference. Pass the expected parent, expected tree, and prepared index to the commit worker. On return require the current tip to be a single-parent commit with that parent and tree. On restart, adopt a reachable commit with the exact recorded parent and tree, even if later phases have committed afterward. A checkpoint without a matching commit proves preparation only. If the commit is still pending, revalidate the selection before reuse. One slice, one commit.

## Verify before return

- The retained `review` revision reads back and its fingerprint still matches the slice.
- In-plan issues are gone, or the run is blocked at a reconstructed cap.
- The save evidence the save skill names was re-read.
- Acceptance and phase status were finalized per the finalize effect, with closure verified on a final plan-backed run.
- `git` shows the new commit as the current tip, with the prepared parent and tree.
- Return the commit SHA, retained revision ids, artifact paths, out-of-plan findings, and any blocker.

A subagent summary is not evidence. A blocked run does not commit.
