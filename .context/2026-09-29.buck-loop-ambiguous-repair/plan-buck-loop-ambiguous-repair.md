---
status: completed
date: 2026-09-29
subject: 2026-09-29.buck-loop-ambiguous-repair
topics: [buck-loop, ambiguous-postcondition, self-repair, operator-stop]
research: []
iterations: [iterate-buck-loop-ambiguous-repair.md]
memory: [buck-loop-ambiguous-repair-2026-09-29.md]
---

# Plan: Ambiguous buck-loop repair

## User Goal

An operator running `/buck-loop` sees why a phase did not land. The loop repairs that itself when it can. When the repair changes the running loop extension, it stops and tells them to restart OMP before continuing.

## Goal

Replace the opaque `ambiguous` retry with a fix-or-stop decision. The scan still means "the expected artifact did not land." The supervisor then either repairs that, retries once when it can finish without the operator, or stops with the reason. A repair under `extensions/buck-loop/` stops the run after it lands, because this process is still running the previous extension.

## Context used / assumptions

- Session context: Phase 1 of `.context/2026-09-28.sql-memory-buck-loop` stayed `in-progress` because `SQL_MEMORY_TEST_URL` and `SQL_MEMORY_TEST_DISPOSABLE` were unset. The scanner returned `ambiguous`. Jev picked `retry`. The run later blocked on unstaged spin-fix files, which the child did not write.
- `extensions/buck-loop/scan.ts` confirms a build only when `status: completed` or every phase is complete. It does not read the hold note.
- Working-tree draft already exists and is uncommitted: `extensions/buck-loop/ambiguity.ts`, plus changes in `loop.ts`, `machine.ts`, `types.ts`, and their tests. A local `lizard -C 10` on `ambiguity.ts` reported no violations after `readNoul` was split. The last full `npm run guardrails:check` failed that function at CCN 13 before the split, and has not been re-run since the restart-stop edit.
- Assumption: "the loop itself" means paths under `extensions/buck-loop/`. Other extensions, including `extensions/sql-memory/`, are not a restart stop.
- Assumption: a missing disposable database is operator input. The supervisor must not invent `SQL_MEMORY_TEST_URL`.

## Scope

- On an ambiguous work postcondition, repair a phase whose acceptance boxes are all `[x]` by writing `status: completed`.
- Otherwise ask native Jev `noul` whether the supervisor can resolve it without the operator. Yes only if another skill run or a status write would confirm it. No if credentials, a disposable database, or other operator input is required. Threshold `0.8`. Jev failure or a missing probability is no.
- If no, block with `cannot fix without the operator` plus the phase status, unchecked boxes, and the execution-checkpoint sentence when present. Do not offer `advance`.
- If yes, retry the same skill once. A second ambiguous result still blocks.
- If that retry changes `extensions/buck-loop/`, warn and block with `Restart OMP before continuing`. Do not continue to review or commit in this process. Do not let the dirty-tree halt replace that reason.
- An `advance` into another state resets the retry budget. A first failure there still gets its normal one retry.

## Out of scope

- Implementing the SQL-memory child seam. That remains `.context/2026-09-28.sql-memory-buck-loop`.
- Providing or guessing a disposable database.
- Reloading the running OMP process from inside the loop.
- Changing the scan rule so unchecked criteria count as completed.
- Restart-stop for edits outside `extensions/buck-loop/`.

## Affected files

- `extensions/buck-loop/ambiguity.ts`
- `extensions/buck-loop/loop.ts`
- `extensions/buck-loop/machine.ts`
- `extensions/buck-loop/types.ts`
- `extensions/buck-loop/__tests__/loop.test.ts`
- `extensions/buck-loop/__tests__/machine.test.ts`

## Implementation steps

1. Keep the working-tree draft. Do not start a second design.
2. Confirm `readNoul` and the new restart helpers stay at or under CCN 10.
3. Confirm these supervisor outcomes against the temp-repo tests:
   - all boxes `[x]` and status not completed → status becomes `completed`, no Jev call, loop continues
   - fixability no → one build, then `cannot fix without the operator`, no continuation choice
   - fixability yes and no loop-extension diff → one retry, then the existing ambiguous ceiling
   - fixability yes and a diff under `extensions/buck-loop/` → warning plus `Restart OMP before continuing`, no review
   - confirmed build then a failed review → that review still gets one retry
4. Re-run `npm run guardrails:check`. A required failure blocks closeout.
5. Commit only these supervisor files and this plan. Leave the SQL-memory hold notes and unrelated dirt out of the commit.

## Acceptance criteria

- [x] An ambiguous build with unchecked criteria and a no fixability answer stops after one child, and the operator-facing reason names the status and the unchecked boxes.
- [x] An ambiguous build whose boxes are all `[x]` is marked `status: completed` by the supervisor and does not ask Jev.
- [x] A yes answer retries once. It does not advance an incomplete phase.
- [x] A retry that changes `extensions/buck-loop/` stops with `Restart OMP before continuing` and does not start review in that process.
- [x] A cross-state advance does not consume the destination state's failure retry.
- [x] `npm run guardrails:check` passes its required gates.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/loop.test.ts extensions/buck-loop/__tests__/machine.test.ts`
- `lizard -C 10 -w extensions/buck-loop/ambiguity.ts extensions/buck-loop/loop.ts`
- `npm run guardrails:check`
- After commit and an OMP restart, a new `/buck-loop` on the SQL-memory subject must stop with the operator reason while the disposable URL is unset, not spin.
- Verification boundary: temp-repo public-entrypoint smoke proved operator and restart stops. The post-commit, freshly restarted OMP run on the SQL-memory subject is not yet exercised; the current process still has the old extension loaded.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:

1. Run `/b-build` against this plan. The draft in the working tree is the implementation; finish and verify it, do not redesign it.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a separate `/b-plan` → `/b-build`. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.

## Risks

- The running OMP process will not load this code until restart. A loop started before restart still has the old supervisor.
- Jev can say yes when a prerequisite is only in prose. The one-retry ceiling then stops the second pass, but one extra child still runs.
- `haltInCycleBlock` rewrites blocked reasons when non-`.context` files are unstaged. The restart reason must stay intact.
- This checkout already has unstaged supervisor edits and many SQL-memory hold notes. A careless commit will mix them.
