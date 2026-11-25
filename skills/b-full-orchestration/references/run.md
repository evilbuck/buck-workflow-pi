# Run

You are the run worker for one slice. Load this file and the run machine in [`stage-map.md`](stage-map.md). Do not load `SKILL.md`. Do not sequence other phases.

The brief names the subject, the slice, a start-stage hint, whether this is the final run, and the caps with their reconstructed counts. The hint loses when evidence disagrees. Take the run machine's first true row. This file is the effect of those edges, not a second route.

## Effects

Dispatch one stage subagent at a time. Resolve every dispatch target through the stage map's resolution table and use its canonical stage brief in [`stage-map.md`](stage-map.md). You are not that stage's worker.

Stage workers implement only this slice. Review workers stay read-only except the review artifacts their skill writes. If source files changed under a review worker, reject the result and re-dispatch.

**Review retention effect.** After every review verdict, including a clean pass, retain a `review` artifact through `workflow_state` — `write` it, then `read` the returned revision back: subject and slice identity, review cycle, baseline commit, implementation fingerprint, verdict, gate evidence, documentation and how-to impact, in-plan iterate reference, out-of-plan findings. Compute the fingerprint from the slice's actual paths and content: `git hash-object` each in-scope path's working-tree bytes, record tracked deletions, include new files. Never `HEAD` alone, never a filename list. Exclude the review report and the bookkeeping it generates. Independently inspect the evidence the review cites — re-run the gate command, re-read the named files — before advancing. Missing, mismatched, or stale proof is not a pass. `orchestration.md` stays a hint, never this record's equal.

**Finalize effect.** Read the canonical acceptance result. Set an unphased plan to `status: completed` only for a non-empty, fully verified checklist; never check a box on the builder's behalf. Finalize phase status before the phase's commit. Save. On a final plan-backed run, inspect the lifecycle and run `close-verified` if closure is pending, then reinspect and require verified completion before preparing the commit — a saved artifact is not closure proof:

```bash
bun skills/_shared/scripts/subject-lifecycle.ts inspect --subject .context/<folder> --json
bun skills/_shared/scripts/subject-lifecycle.ts close-verified --subject .context/<folder> --json
```

Pass the `.context/<folder>` path; a bare folder name does not resolve. Do not edit the subject index yourself. Intermediate phases leave the subject open; quick-fix runs have no closeout edge. Return actual blockers, never a successful completion with a blocker list.

**Commit preparation effect.** After save and closure, construct the exact candidate patch: attributable source plus the required repo-projected records the stages retained. Where the harness provides an isolated, scoped commit facility, prepare the selection there and pass it with the expected parent to the commit stage — not the live shared index. Otherwise stage exactly the candidate paths with `git add`, leaving unrelated staged, unstaged, and overlapping edits untouched, and dispatch `b-commit` with the expected parent SHA. When a prepared selection cannot cross a worker boundary, hand the commit worker a verifiable description of the exact patch and require it to reconstruct and compare before committing. A declared path is not ownership of every hunk in it. If ownership, parent, or candidate no longer matches, stop before any mutation. After the commit, verify its parent, patch, and SHA; do not stamp tracked completion state afterward. On a non-repo-files store, retained records stay revision references, not checkout mirrors. One slice, one commit. No `--force`. Do not commit on `main`, `master`, `dev`, or `develop` — take `commit → blocked` and stop (the orchestrator leaves protected branches before the first edit). Do not stash, reset, or clean.

## Verify before return

- The retained `review` revision reads back and its fingerprint still matches the slice.
- In-plan issues are gone, or the run is blocked at a reconstructed cap.
- The save evidence the save skill names was re-read.
- Acceptance and phase status were finalized per the finalize effect, with closure verified on a final plan-backed run.
- `git` shows the new commit as the current tip, with the prepared parent and patch.
- Return the commit SHA, retained revision ids, artifact paths, out-of-plan findings, and any blocker.

A subagent summary is not evidence. A blocked run does not commit.
