---
type: grill-session
date: 2026-10-03
subject: 2026-10-03.review-severity-ranking
mode: user
total_questions: 6
assessment_threshold: 20
decision_domains:
  - name: Skip record
    questions: [1]
    resolved: 1
    deferred: 0
  - name: Iterate ceiling
    questions: [2]
    resolved: 1
    deferred: 0
  - name: Jev retry
    questions: [3]
    resolved: 1
    deferred: 0
  - name: Jev evidence
    questions: [4]
    resolved: 1
    deferred: 0
  - name: Garbled report
    questions: [5]
    resolved: 1
    deferred: 0
  - name: Docs evaluation scope
    questions: [6]
    resolved: 1
    deferred: 0
status: completed
boundary_assessment: cohesive
---

# Grill Session: review severity ranking

Joined `.context/2026-10-03.review-severity-ranking/`. The plan's Light Grill closed four items by assumption. This session pressures the ones code does not already settle.

## Explored, not asked

- `hasIterate()` is true for any unfinished `iterate-*.md` whose status is not `completed` (`extensions/buck-loop/scan.ts`). `ranking-*.md` does not match. A-3 and A-7 hold.
- `b-iterate` owns `status: completed` plus `completed: YYYY-MM-DD`. That means the issues were worked, not that the loop should ignore them (`skills/b-iterate/SKILL.md`).
- Review template: Critical issues have **Proposed fix**. Warnings have **Suggested approach**, not Proposed fix (`skills/b-review/SKILL.md`). A parser that requires only a title and a Problem bullet matches the template. The Jev payload must accept either fix field.
- No iterate artifact and an unparseable report already opens iterate/document/save (`machine.ts` reviewing edges). A-2 holds.
- Jev failure is a two-strike rule. The loop asks Jev once more in the same step before it saves. First failure is recorded on the issue. Second failure: the issue is valid. No chat fallback. See Q3.
- Below-waterline route when the report is parseable is already confirmed: documenting if docs or howto impact, otherwise saving.
- `jev-tool` has no batch cap. One call with named questions per issue stays an implementation risk (plan A-8), not a user question yet.
- Canonical review name is `iterate-<subject>.md`. `hasIterate()` is any-match, so two unfinished files are possible. Later question.

## Decision Domains

### Domain: Skip record
- Q1: When nothing is above the waterline, may ranking set `iterate-*.md` to `status: completed`? → resolved: no. Status is `below-waterline`. `hasIterate()` must ignore it. Do not set `completed` or `completed:`. Amended: a first Jev failure is below the waterline with a note to re-review with Jev. A second failure is a valid issue. No LLM fallback.

### Domain: Iterate ceiling
- Q2: After 6 fix rounds, if this review has nothing worth fixing, does the loop still stop and wait, or does it continue to docs or save? → resolved: move on. Do not stop only because 6 rounds were already used. A second Jev failure is still worth fixing, so that case does not move on; at 6 rounds the existing stop applies. Cutover: no in-progress loop. Do not design a resume path for a loop caught mid-cycle.

### Domain: Jev retry
- Q3: When Jev fails the first time, does the loop ask Jev again before it saves, or is the note only for a person? → resolved: the loop asks Jev. Same step, one retry, before save. The note records the first failure. It is not only for a person. Second failure is a valid issue.

### Domain: Jev evidence
- Q4: Does Jev see the cited file, or only the reviewer's paragraph? → resolved: reviewer paragraph plus the current text of the named file. Not the diff alone. Not the whole repo. Operator confirmed the delegated Jev pick. A missing or too-big file is a Jev failure: one retry, then the issue is valid.

### Domain: Garbled report
- Q5: If nothing is worth fixing but the review report is garbled, does the loop still ask the operator? → resolved: evaluate. The loop judges whether the docs need updating. It does not ask the operator. It does not save just because the code issues were not worth fixing. Reading, not yet a separate question: that judgment is a Jev call. Yes means document. No means save.

### Domain: Docs evaluation scope
- Q6: Evaluate docs impact only when the report did not say, or every time? → resolved: trust a clear report. Judge only when the report did not say.

## Boundary Assessment

Threshold 20 was not reached. Six questions, one concern: the post-review spend gate. No new phase split. The plan already requires `/b-phase`.

## Decision Closure

Closure is ready for `/b-phase`. Two defaults were not asked: a docs evaluation that fails twice opens the existing choice; two unfinished iterate files block.

Selected course: `status: below-waterline` is the skip record. If nothing worth fixing remains and the report is clear, trust it and move on, including after 6 fix rounds. If the report did not say, Jev evaluates docs and how-to impact. Yes documents. No saves. A second failure of that evaluation asks the operator. First issue-level Jev failure retries once in the same step. Second failure: that issue is valid. Jev sees the reviewer paragraph plus the current text of the named file. No chat model. No in-progress loop at cutover.

Evidence: Q6 operator turn "trust a clear report" classified `direct_answer` by jev-1.13.0 (confidence 1.0). Q5 "evaluate" the same.

Assumptions:

- A-G1: `status: completed` may mean "ranked below the waterline." `status: invalidated`. `blocking: false`. Evidence: Q1.
- A-G2: `hasIterate()` can ignore `below-waterline` the way it ignores `completed`. `status: deferred`. `blocking: false`. Validation path: scan unit test before the machine edge.

Material risks: a second Jev failure iterates a finding that was never scored. That is the operator's rule. A first failure still skips a real High for one pass. Rollback remains the `reviewing → iterating` edge in `machine.ts`.

Excluded scope: waterline thresholds, human `/b-review` outside the loop. Chat fallback is excluded again.

Next action: `/b-phase`. Do not start `/b-build`.

## Deferred Questions

## Addenda

- 2026-10-03, superseded: "Don't let Jev skip. Assume valid, or fall back to the LLM." Turn class `addendum` (jev-1.13.0, confidence 0.33). Replaced by Q1: below waterline, note the Jev failure, re-review with Jev.
- 2026-10-03: "The note to re-review with Jev is to give Jev a second chance to avoid unnecessary work. A second failure is still a valid issue." Turn class `addendum` (jev-1.13.0, confidence 0.96, P(addendum) 0.98). Does not answer Q2. First failure stays below the waterline so a later Jev pass can still skip the work. Second failure is valid: do not skip it. No chat model.
- 2026-10-03: "I don't know. Explain it better. I don't have the context." Turn class `addendum` (jev-1.13.0, confidence 0.94, P(addendum) 0.96). Does not answer Q2. Restate Q2 in plain language.
- 2026-10-03: "Use the TypeSafe Jev skill to call the Jev tool for that decision. Send just the assessment and any pertinent context it would need." Turn class `addendum` (jev-1.13.0, confidence 0.95, P(addendum) 0.97). Does not answer Q4. Delegated call, same model: payload `paragraph_and_cited_file` (confidence 0.43, P 0.57; diff 0.29; paragraph 0.14; repo 0). Noul that the paragraph alone judges a real defect: 0.23. Q4 still open.
- 2026-10-03: "just ask me." Turn class `addendum` (jev-1.13.0, confidence 0.95, P(addendum) 0.97). Does not answer Q5. Doc mode file is not the answer channel. Ask Q5 in chat.
- 2026-10-03: "What's the context? Why do the docs need updating?" Turn class `addendum` (jev-1.13.0, confidence 0.96, P(addendum) 0.98). Does not answer Q5. Docs may not need updating. The report failed to say. Restate that and repeat Q5.
- 2026-10-03: "evaluate if the docs need updating too." Turn class `addendum` (jev-1.13.0, confidence 0.70, P(addendum) 0.80, P(direct_answer) 0.20). Does not answer Q5. Third route: the loop judges docs impact itself. Not ask-you, not save-anyway.
- 2026-10-03: "I don't know." Turn class `addendum` (jev-1.13.0, confidence 0.34, P(addendum) 0.56, P(arbitrary) 0.41). Does not answer Q5. Do not close Q5 on a decline.

## Parked

