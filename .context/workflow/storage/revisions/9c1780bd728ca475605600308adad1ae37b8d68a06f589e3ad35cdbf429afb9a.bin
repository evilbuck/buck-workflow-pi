---
status: completed
date: 2026-10-03
subject: 2026-10-03.review-severity-ranking
topics: [buck-loop, jev, review, severity, ranking]
research: [research-severity-weighting.md]
iterations:
  - iterate-phase-1-types-scan-pure-waterline.md
  - iterate-phase-2-jev-ranking-core.md
memory: []
sql_memory_ids:
  - 01a1025d-c2a2-74cf-baa8-f6f4f9a1e853
  - 01a104c8-5bcf-73e3-b861-f77e6257f093
  - "01a109b4-3261-762c-8598-fe95de11c7f8"
  - "01a109be-2ad3-76c5-808e-80944ad0229e"
  - "01a10c0e-084e-78f1-8636-8488b3582531"
  - "01a10c10-77db-7ce2-97aa-27e53c317383"
---

# Plan: review severity ranking

## User Goal

The operator running autonomous `/buck-loop` stops paying time and tokens for review findings that do not matter to the end user or the business. After review, each in-plan issue is severity-ranked. Only an issue above the waterline starts `b-iterate`. Below-waterline findings stay on the record, and the loop continues.

## Goal

Insert a `ranking` state immediately after a review that found in-plan issues. TypeSafe Jev scores each issue. A deterministic function outside Jev applies the stored waterline. Any issue above it routes to `iterating`. None do not.

## Context used / assumptions

- User-provided context: post-review gate; rank severity, likelihood, scope, and regression with TypeSafe Jev; above the waterline iterates; otherwise continue.
- Session context: operator is the beneficiary; the point is also to avoid autonomous token spend. Below the waterline, keep today's non-iterate route.
- Artifacts used: `brainstorm-review-severity-ranking.md`, `research-severity-weighting.md`.
- Stored rating: SQL memory `01a1025d-c2a2-74cf-baa8-f6f4f9a1e853`, phase `severity-rating`. Vault note `30_Resources/AI/Review Issue Severity Rating.md`.
- Code: `extensions/buck-loop/machine.ts` treats any unfinished `iterate-*.md` as an iterate win. `ReviewFacts` has no per-issue fields. `Effect` has no judge-call variant. `loop.ts` `runEffect` only executes `choose` and `run-skill`. `hasIterate()` ignores a completed iterate artifact. `choice.ts` falls through to a chat model; this gate must not.

## Light Grill

Planning closed four items by assumption. The 2026-10-03 grill superseded the ones that conflict with operator answers. Record: `grill-session-review-severity-ranking.md`.

- Q1: Where do below-waterline findings live? → superseded: `ranking-*.md` holds the judgment. The iterate file stays, with `status: below-waterline`, not `completed`. `hasIterate()` must ignore `below-waterline`. Do not delete the file. Do not set `completed:`.
- Q2: What does an unparseable review do? → superseded in part: no iterate artifact keeps today's choice. Zero parsed issues blocks. An artifact that parses is ranked. If nothing is above the waterline and the report did not say, the loop evaluates docs and how-to impact. It does not ask first, and it does not save by default. A clear report is trusted.
- Q3: State name? → resolved: `ranking`.
- Q4: How is an issue identified? → resolved: `critical:<n>` or `warning:<n>` from the iterate artifact section and 1-based ordinal.

## Decision Closure

Selected course: add `ranking` as a non-`WorkState` with a new `rank` effect. The loop calls Jev in-process, writes an audit file, then rewrites the iterate artifact or marks it `below-waterline`. The machine, not Jev, picks `iterating`, `documenting`, `saving`, `blocked`, or the existing choice. A clear docs report is trusted. A garbled one is evaluated by Jev. First Jev failure retries once in the same step. Second failure on an issue means that issue is valid. No chat model.

Trade-off: a second Jev failure spends a fix cycle on an unscored finding. That is the operator's rule. The compensating control is the retry, the note on the first failure, and the audit file. A scan-defect block remains when the iterate artifact cannot be parsed at all.

Evidence: grill session 2026-10-03, Q1–Q6, each closing turn classified `direct_answer` by jev-1.13.0. Waterline math remains stored decision `01a1025d-c2a2-74cf-baa8-f6f4f9a1e853`. The fail-closed skip and the no-retry rule in that memory are superseded for this gate.

Excluded scope: human `/b-review` still writes `iterate-*.md`. This plan does not change that skill. Out-of-plan issues are not ranked. A clear docs or how-to flag is not re-judged. `choice-ranking.ts` stays display-only. No chat-model fallback. No CVSS equation. No change to the stored thresholds. No site HTML copy of the state diagram. No resume path for a loop caught mid-cycle at cutover.

Next action: Restart OMP before a new loop invocation to load the shipped extension. All four phases are verified and checkpointed manually; the old blocked run projection is retained, not forged done.

## Assumptions Ledger

- A-1: In-plan issues are the `## Critical Issues` and `## Warnings` subsections of the unfinished `iterate-*.md`, in the shape `skills/b-review/SKILL.md` already specifies. Warnings use **Suggested approach**, not **Proposed fix**. `status: validated`. `blocking: false`. Validation path: a fixture copied from that template, parsed in the ranking unit test, before the machine edge is added. Evidence: completed phase tests and review-phase-3-machine-loop-routing.md.
- A-2: An unparseable review with no iterate artifact must stay on the existing closed choice. `status: validated`. `blocking: false`. Evidence: `reviewUnparseable()` and `machine.test.ts` reviewing-choice cases.
- A-3: `status: completed` on `iterate-*.md` makes `hasIterate()` false. `status: validated`. `blocking: false`. Evidence: `scan.ts` `hasIterate()` and `scan.test.ts` "ignores completed iterate artifacts". This status is not the skip record.
- A-4: A `rank` effect can run in `loop.ts` `runEffect` without a nested skill session. `status: validated`. `blocking: false`. Evidence: `runEffect` already branches on effect kind and returns without a child when the kind is not `run-skill`.
- A-5: Jev unavailable, or a missing scope, confidence, impact, or likelihood answer, does not iterate. `status: invalidated`. `blocking: false`. Evidence: grill Q1 and Q3. First failure retries once. Second failure treats that issue as valid.
- A-6: No issue above the waterline, and a parseable report, routes to `documenting` when docs or howto impact is flagged, otherwise `saving`. `status: validated`. `blocking: false`. Evidence: user confirmation 2026-10-03, grill Q2 and Q6. This does not apply to a garbled report.
- A-7: `ranking-*.md` does not satisfy `hasIterate()`. `status: validated`. `blocking: false`. Evidence: `scan.ts` matches only `iterate-*.md`.
- A-8: One Jev call with named questions per issue is enough for a successful rank. One invalid answer fails that issue only. A thrown call fails that call's issues, then one retry runs. `status: validated`. `blocking: false`. Validation path: ranking unit test with two issues, one missing answer, and a second test where the first judge call throws and the retry succeeds. Evidence: completed phase tests and review-phase-3-machine-loop-routing.md.
- A-9: `hasIterate()` ignores `status: below-waterline` the same way it ignores `completed`. `status: validated`. `blocking: false`. Validation path: scan unit test before the machine edge. Evidence: completed phase tests and review-phase-3-machine-loop-routing.md.
- A-10: Two unfinished `iterate-*.md` files block. The loop does not pick one. `status: validated`. `blocking: false`. Validation path: ranking test with two unfinished files expects `blocked`. Evidence: completed phase tests and review-phase-3-machine-loop-routing.md.
- A-11: A docs or how-to evaluation that fails twice opens the existing choice. It does not iterate, save, or assume an update is needed. `status: validated`. `blocking: false`. Validation path: machine test. Operator can reject this default before `/b-phase`. Evidence: completed phase tests and review-phase-3-machine-loop-routing.md.

## Material Risks

- R-1: Jev fails twice, so an unscored finding is iterated. Impact: one fix cycle on a finding that was never scored. Mitigation: one retry in the same step; note the first failure; do not call a chat model. Rollback: restore the `reviewing → iterating` edge in `machine.ts` so an unfinished iterate artifact wins again. Validation path: keep a machine test that names this edge; reverting that edge and running the pre-change assertion (`iterate artifact present → iterating`) is the recovery check.
- R-2: The parser drops every issue and the loop treats that as "nothing to iterate". Impact: silent skip of in-plan defects. Mitigation: an unfinished iterate artifact that parses to zero issues blocks with a scan-defect reason. It does not save. Rollback: same edge restore as R-1. Validation path: ranking or scan test with an iterate artifact that has no `###` issue headings expects `blocked`, not `saving`.
- R-3: The iterate-artifact rewrite drops an above-waterline issue. Impact: `b-iterate` never sees it. Mitigation: write `ranking-*.md` first; the iterate artifact is rewritten only from that file's above-waterline set. Validation path: unit test that the rewritten artifact contains exactly the above-waterline ids and no others.
- R-4: A chat model imitates the judgment. Impact: the spend gate is no longer the stored rating. Mitigation: the ranking module calls `runJev` only. It must not import `choose` or `callChoiceModel`. Validation path: unit test injects the ask function and asserts a thrown judge error does not invoke a second caller. The one retry is a second `runJev`, not a chat call.
## Scope

- New `ranking` state and `rank` effect.
- Parse in-plan issues from the unfinished iterate artifact.
- Apply the stored five-question rating and the matrix below.
- Route from ranking without reopening the unparseable choice.
- Record every ranked issue. Mark the iterate artifact `below-waterline` when nothing is above the waterline; never mark skipped work completed.
- Tests for the new edges and the pure waterline function.

## Out of scope

- Editing `skills/b-review/SKILL.md` or its bundled copy.
- Ranking out-of-plan issues or re-judging clear documentation/how-to flags.
- Changing `choice-ranking.ts` or legal-choice selection.
- A feature flag. Rollback is the machine edge, not a runtime switch.
- Copying the state diagram into `site/`.

## Affected files

- `extensions/buck-loop/types.ts`
- `extensions/buck-loop/machine.ts`
- `extensions/buck-loop/scan.ts`
- `extensions/buck-loop/loop.ts`
- `extensions/buck-loop/persist.ts`
- `extensions/buck-loop/ranking.ts` (new)
- `extensions/buck-loop/__tests__/machine.test.ts`
- `extensions/buck-loop/__tests__/scan.test.ts`
- `extensions/buck-loop/__tests__/loop.test.ts`
- `extensions/buck-loop/ranking.test.ts` (new)
- `docs/state-machine-diagram.html` (reviewing description)
- `docs/buck-loop.md` if it documents the review exit

## Waterline contract

Jev answers, per issue, and does no arithmetic:

| Id | Type | Labels |
|---|---|---|
| scope | choice | `in_scope`, `out_of_scope` |
| real | noul | P(the finding is a real in-code defect) |
| impact | score | negligible, minor, moderate, major, catastrophic |
| likelihood | score | rare, unlikely, possible, likely, almost_certain |
| regression | choice | `regression`, `pre_existing`, `unknown` |

Map impact and likelihood to `0..4` in that order. Floor valid native fractional scores before matrix lookup (operator decision 2026-10-05); retain raw answers in the audit. Cell labels are Note, Low, Medium, High, Critical.

| Impact \ likelihood | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| 0 | Note | Note | Low | Low | Low |
| 1 | Note | Low | Low | Medium | Medium |
| 2 | Low | Low | Medium | Medium | High |
| 3 | Medium | Medium | Medium | High | High |
| 4 | Medium | Medium | High | High | Critical |

Likelihood `0` or `1` caps the cell at Medium. The table already includes that cap.

An issue is above the waterline only when all of these hold:

- scope is `in_scope`
- P(real) is a finite number `>= 0.60`
- impact and likelihood are finite numbers in `0..4`
- the cell is High or Critical, or the issue is a regression and the cell is at least Medium and impact is at least `2`

A missing Q1–Q4 answer, or a judge failure, retries that issue once in the same step. The note on the issue says Jev failed and to re-review with Jev. A second failure means that issue is valid: it is above the waterline for routing. A missing Q5 does not bump. Do not use a chat model.

State sent to Jev is the issue title, problem, file path, proposed fix or suggested approach, the plan or phase path, and the current text of the named file. Not the repo. A missing or too-big file is a Jev failure.

## Implementation steps

1. Add `ranking` to `LoopState`. Exclude it from `WorkState`. Add `{ kind: "rank" }` to `Effect`. Allow the state in `persist.ts`. Old projections still load. Do not design a mid-cycle resume; cutover assumes no loop is in progress. Include `ranking` in `FROZEN_PHASE`. Do not add it to `IN_CYCLE_WORK_STATES`.
2. Parse unfinished `iterate-*.md` into issues with ids `critical:<n>` and `warning:<n>`. Require a title and a Problem bullet. Accept **Suggested approach** as the fix field. Zero parsed issues from a file `hasIterate()` would accept is a scan defect, not an empty rank. Two unfinished iterate files block.
3. Add a pure `aboveWaterline()` and a `rankIssues()` that calls `runJev`. On a failure, call `runJev` once more for the failed issues. Write `ranking-<utc>.md` first, with each id, raw answer, cell, above/below, and any Jev-failure note. Then rewrite the iterate artifact to the above-waterline issues only, or set `status: below-waterline` when that set is empty. If the audit write fails, block and do not route onward.
4. Change the reviewing exit. Session ok and an unfinished iterate artifact and ranking still pending goes to `ranking` with effect `rank`. Do not go straight to `iterating`. No artifact keeps today's docs, save, and unparseable-choice edges.
5. From `ranking`, after a completed rank: any above-waterline issue and iterate budget left goes to `iterating`; any above-waterline issue and no budget left uses the existing limit block; none above and a parseable docs or howto flag goes to `documenting`; none above and a parseable report with neither flag goes to `saving`, including at the iterate ceiling. None above and a garbled report calls Jev for docs impact and how-to impact. Either yes goes to `documenting`. Both no goes to `saving`. A second failure of that evaluation opens the existing choice. It does not iterate and does not save. Do not offer iterate from this state when nothing cleared the waterline.
6. Handle `rank` in `runEffect`. No nested session. No `choose()` and no profile chat model. One retry is allowed, and it is another `runJev`. Do not increment `iterateCyclesOnPhase` or `loopCount` for the rank call.
7. Update the reviewing description in `docs/state-machine-diagram.html`, and the review-exit sentence in `docs/buck-loop.md` if that sentence exists.

## Acceptance criteria

- [x] A review with an unfinished iterate artifact transitions to `ranking` and does not run `b-iterate` before the rank effect.
- [x] One above-waterline issue, and iterate budget remaining, transitions to `iterating` and the iterate artifact contains only above-waterline ids.
- [x] No above-waterline issue, and a parseable report, transitions to `documenting` when docs or howto impact is flagged, otherwise to `saving`, including at the iterate ceiling, and `hasIterate()` is false because the iterate file is `below-waterline`.
- [x] Likelihood `0` or `1` does not produce a High or Critical cell.
- [x] A regression can clear a Medium cell only when impact is at least moderate. It cannot clear an out-of-scope or low-confidence issue.
- [x] A Jev failure retries once. The second failure iterates that issue and does not call a chat model. The first failure is noted on the issue.
- [x] An unfinished iterate artifact that parses to zero issues blocks. It does not save.
- [x] An unparseable review with no iterate artifact still opens the existing iterate/document/save choice.
- [x] `ranking-*.md` does not set `iterateArtifact`.
- [x] A projection written before this change still loads. Mid-cycle resume is not required.

## Verification

- Unit-test `aboveWaterline()` with no network: cap, regression bump, missing answer, out of scope, P(real) below `0.60`.
- Machine tests for the reviewing and ranking edges above.
- Scan test that a completed iterate artifact, a `below-waterline` iterate artifact, and a `ranking-*.md` do not set `iterateArtifact`.
- Loop test that effect `rank` calls the injected ask function and does not spawn a skill session.
- Closeout: `npm run guardrails:check`. Focused vitest is the inner loop, not the closeout gate.

## Execution Instructions

<!-- OMP opt-in: this plan is recommended to run under goal mode only after phasing, or not as one 12k session. The user goal is one objective, which matches goal, but the file count and the new effect make a single unphased session the wrong envelope. -->

This plan is large enough to phase. Run `/b-phase` before `/b-build-hard`. Do not run `/b-build`.

If phased, the first matching OMP rule becomes orchestrate only when there are at least four phases and a hard dependency. Until then, do not start an execution session.

If the user declines phasing, the unphased recommendation is `goal`, and the formula default of 12k tokens is too small. Confirm a 50k budget before `/goal set`. Suggested text: the operator running autonomous `/buck-loop` stops paying an iterate cycle for review findings that do not matter to the end user or the business.

1. Run `/b-phase` on this plan.
2. Execute one phase with `/b-build-hard`.
3. Run `/b-review` against that phase.
4. If review writes an `iterate-*.md` for this plan, run `/b-iterate`, then `/b-review` again. Out-of-plan findings do not iterate.
5. If review flags documentation impact beyond the diagram and buck-loop doc named above, run `/b-docs` before `/b-save`.
6. Run `/b-save`, then `/b-commit`.

## Risks

- A second Jev failure spends a fix cycle on an unscored finding. See R-1. The stored fail-closed skip is superseded.
- Nothing worth fixing moves on, including after 6 fix rounds. A second Jev failure is worth fixing, so the iterate ceiling still blocks that case.
- Human `/b-review` outside the loop is unchanged, so a person can still iterate a nit the loop would have skipped.
