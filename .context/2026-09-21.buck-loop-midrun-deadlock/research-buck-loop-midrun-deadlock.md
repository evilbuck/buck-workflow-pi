---
date: 2026-09-21
status: active
domains: [extensions, buck-loop, diagnosis]
topics: [buck-loop, mid-run-block, dirty-tree-guard, choose-evidence, postcondition]
related: []
priority: high
subject: 2026-09-21.buck-loop-midrun-deadlock
informs: []
---

# Diagnosis: `/buck-loop` blocks mid-run and cannot resume

Reported run: `/buck-loop .context/2026-09-18.non-recruiter-pipeline-visibility/`
in `/Users/buckleyrobinson/projects/Employ/Lever/lever.data-api` (branch
`buck/explore`, herdr tab `data-api`). Observed state: `blocked`, `loopCount` 1/12,
after a single `b-build-hard` session.

## Phase 1 — feedback loop (red command)

Throwaway vitest file `extensions/buck-loop/__tests__/repro-resume-deadlock.test.ts`
(deleted after diagnosis), run with
`npx vitest run extensions/buck-loop/__tests__/repro-resume-deadlock.test.ts`.
Deterministic, ~1s, two scenarios, both red against `HEAD`.

Scenario A — child writes a deliverable outside `.context/`, does not complete the
phase, chooser returns `block`; then `resume`:

```
AssertionError: expected 'working tree is dirty; commit or stas…' not to match /dirty/
+ Received: "working tree is dirty; commit or stash unrelated changes before /buck-loop"
```

Scenario B — human commits the loop's own output, then `resume`:

```
{"resumed":{"state":"blocked","reason":"accepted choice: block"},
 "calls":["b-build"],"loopCount":2,"chooseCalls":2}
```

## Corrections to the first-pass diagnosis

| Claim | Verdict | Evidence |
|---|---|---|
| "5 of 8 acceptance criteria are checked `[x]`" | **False** | `grep -c '\[x\]' phase-1-…md` → `0`. The file lists 10 criteria, all `[ ]`. |
| "Phase/plan/index files edited to record Q2/Q4/Q5" | **False** | `git status --porcelain` shows **no** modified tracked files. Phase/plan/index are tracked and untouched. Q2/Q4/Q5 exist only in the untracked design note + `draft-commit.md`. |
| "postcondition scan hit an ambiguous result" (because criteria are mixed) | **Mechanism wrong** | `scan.ts:384` — `building` postcondition reads one frontmatter field: `ctx.complete \|\| phaseStatus === "completed"`. Acceptance criteria are never parsed. `status:` is still `pending`, so `ambiguous` was structurally guaranteed. |
| "it self-selected block … the loop correctly can't auto-advance" | **Overstated** | The block came from a tool-less model call with a 5-field context string, 3.7s after the scan. No reasoning over the phase or the tree was possible. |
| "Nothing to fix in the loop mechanism itself" | **False** | Two reproducible defects (D1, D2) plus two contributing design defects (D3, D4). |

## D1 — the loop's own output makes the run unresumable (blocking)

`refuseUnsafeWorkspace` (`loop.ts:528-544`) refuses `start` **and** `resume` when
any porcelain path outside `.context/` is dirty. The nested child wrote
`docs/cycles/2026-09-21-RMAPSH-1740-per-user-auth.md`, which is untracked and
outside `.context/`. Simulated against the live repo:

```
porcelain: ?? .context/…/draft-commit.md
           ?? .context/…/transition-audits/
           ?? .context/memory/
           ?? docs/cycles/2026-09-21-RMAPSH-1740-per-user-auth.md
dirty:     ?? docs/cycles/2026-09-21-RMAPSH-1740-per-user-auth.md
=> BLOCKED: working tree is dirty
```

The guard's own message — "commit or stash **unrelated** changes" — is wrong here:
the change is the loop's own product, en route to the `committing` state it never
reached. Any mid-run block outside `.context/` wedges the run.

Test-coverage gap that let this ship: `loop.test.ts:168` and `:179` cover dirt the
operator created (`src/unrelated.ts`). Nothing covers dirt the loop created.

## D2 — resume replays the expensive session and re-blocks

`blocked --USER_CONFIRMED--> resolving --> resolving-incomplete --> building`
(`machine.ts:607-618`, `:580-585`). The phase is still `pending`, so `resume`
re-runs the full build child. `difficulty: hard` in this phase's frontmatter →
`nestedSkill` picks `b-build-hard` (`loop.ts:683`). `loopCount` increments on every
re-entry to `building` (`loop.ts:708`). Scenario B proves the cycle:
`b-build` re-run, `loopCount` 1→2, second choose, blocked again.

Nothing in `Snapshot`, the projection, or the phase file records *why* the phase
could not complete, so each resume repeats the same expensive session with the
same information and reaches the same coin flip. Twelve of those exhaust `maxLoops`.

## D3 — the `choose` call has no evidence (root cause of the specific outcome)

Audit record
`.context/2026-09-18.non-recruiter-pipeline-visibility/transition-audits/1790015489068-1-*.json`:

```json
"context": "state=building phase=.context/…/phase-1-auth-spike-and-design-note.md why=postcondition scan ambiguous review=pending postcondition=ambiguous",
"raw": "{\"choice\":\"block\",\"reason\":\"Postcondition remains ambiguous and review is still pending.\"}"
```

- `decisionContext` (`loop.ts:562-573`) passes five scalars and nothing else.
- `choice.ts` calls the model with **empty tools** — it cannot read the phase file,
  the design note, or `git status`.
- `runStep` *returns* the child's final message, and `executeSkill` deliberately
  discards it (`loop.ts:406` "The child's last sentence is ignored"). That text is
  exactly the missing evidence.
- The returned reason is vacuous: `review=pending` is true of every
  `building → ?` decision, so it cannot discriminate `retry` / `advance` / `block`.

The verdict happened to be defensible. It was not reasoned.

## D4 — `building` collapses three disk states into one bit

`pending` (child never started), `in-progress` (`b-build` SKILL.md:430 tells the
child to set this on entry), and any other value all map to `ambiguous`; only
`completed` maps to `confirmed`. The child here left `pending`, meaning it never
followed the b-build lifecycle contract at all — and the loop cannot distinguish
that from "did all reachable work, three criteria are externally gated".

## Fix applied (D1) — ask instead of auto-stopping

Operator decision: a dirty tree is not an automatic stop. Shipped:

- `LoopDeps.confirmDirty(request: DirtyTreeRequest)` — new injectable seam
  (`loop.ts`). Default denies, so headless/RPC runs stay deterministic.
- `refuseUnsafeWorkspace` is now async and asks instead of refusing. A protected
  branch is still a hard refusal — no answer makes committing to `master` safe.
- `dirtyPaths` uses `git status --porcelain --untracked-files=all`; plain porcelain
  collapses a wholly new directory to `docs/`, and the operator is approving files.
- `index.ts` wires `ctx.ui.confirm` (same shape `b-kamal-release` uses), listing up
  to 10 paths and stating the consequence: the loop stages everything before it
  commits, so approved paths land in its commit.
- Blocked reason now names the count and sample paths instead of "commit or stash
  unrelated changes".
- Tests: approval path on `start`, the D1 regression on `resume` (dirt is the
  child's own `docs/cycles/note.md`), protected branch never asks, and both
  no-approver paths still block. `extensions/buck-loop` 190/190 green.

## Remaining fixes (ranked)

1. **F2 (D3).** Put evidence in `decisionContext`: the child's final text (already
   returned by `runStep`), `gitChangedFiles` output, and the phase's unchecked
   acceptance criteria. Until then every ambiguous postcondition is a coin flip.
2. **F3 (D2/D4).** Give the child a way to report "externally gated" — a distinct
   phase frontmatter signal — mapped to a deterministic `blocked` with a reason and
   no model call, and a `resume` that refuses to replay the build until the phase
   file changes.

## Operational unblock for the reported run

1. With the fix loaded, `/buck-loop --resume` now prompts to approve
   `docs/cycles/2026-09-21-RMAPSH-1740-per-user-auth.md` instead of refusing.
2. Do **not** `--resume` expecting progress: it re-runs `b-build-hard` on a phase
   whose three outstanding criteria (Auth0 access-token claim, three-way sign-off,
   CP0 behind the npm.lever.co grant) are outside agent reach (D2).
3. Drive phase 1 by hand (`/b-build-hard` on the phase file) once those land, and
   have it actually write `status:` and the `[x]` checkboxes — the supervisor reads
   nothing else.

## Guardrails verdict

`npm run guardrails:check` → `unit_test_gate: fail`, `global_ratchet: fail`
(coverage `null` because the suite aborts), `complexity_gate: pass`.

The failures are **pre-existing and macOS-only**. Verified in a clean detached
worktree at `origin/master` (`git worktree add --detach /tmp/bwp-master-verify
origin/master`, `node_modules` symlinked in), commit `7dc2aaf` — not by stashing
in place. That worktree fails **10** tests across the same three files: the 5
`serve-presentations` ones fixed here plus the 5 left alone. The working branch
`fix/fix-buck-loop` was at `7dc2aaf` with zero commits of its own
(`git rev-list --left-right --count HEAD...origin/master` → `0 0`), so every
change in this session is uncommitted working-tree state.

- `scripts/hooks.test.mjs` ×4 — three assert a literal `/tmp/...` path against a
  value that canonicalizes to `/private/tmp/...`; one calls GNU `stat -c %a`,
  which macOS `stat` does not accept (`-f %A`).
- `extensions/code-review-iteration/__tests__/git-ops.test.ts` ×1 — worktree path
  comparison, same `/private` class.

`scripts/serve-presentations.test.ts` was in that set (5 failures, every request
403) and is fixed here because it blocked reading the verdict at all:
`resolveRequestPath` realpath'd the target but not the root, so a root reached
through a symlink could never contain it. Root and target are now both canonical,
and the test's temp root is realpath'd. 26/26 green.

The remaining 5 are unrelated to `/buck-loop` and are not fixed here. Own suite:
`extensions/buck-loop` 190/190 green; repo-wide 912/917 with those 5.

## Exit

`b-iterate` for F2 (contained: `decisionContext` plus the text `runStep` already
returns). `b-plan` for F3 — it changes the phase-file contract and the resume path
together.
