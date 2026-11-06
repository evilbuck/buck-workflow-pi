---
status: completed
date: 2026-10-01
subject: 2026-10-01.sql-memory-remember-op
topics: [review, judgment, jev, sql-memory]
informs: [plan-sql-memory-remember-op.md]
---

# Native Jev warning severity assessment

## Scope and evidence

User requested native Jev classification of the review warnings against the current plan and branch changes. Assessment only: no source, tests, plan status, or lifecycle edits.

- Branch: `fix/buck-loop-unphased-closeout`.
- HEAD: `90b5f1ad61286c0da3f93e90b28be0444c94aea8`.
- No upstream configured. Scope is the uncommitted SQL-memory diff relative to HEAD plus untracked SQL-memory modules/tests, not an inferred upstream comparison. Unrelated TUI-preview artifacts excluded.
- Read `plan-sql-memory-remember-op.md`, completed prior iteration, current tracked diff, new `remember`, `identity`, `columns`, and tool/test sources; checked migration 001, canonical b-save SQL section, docs, and supervisor project-upsert pattern.
- Previous-turn guardrails pass is historical evidence only; no tests or live database scenario were rerun for this severity-only assessment.

## Method

Native `tool.jev`, returned model **`jev-1.13.0`**. No prompted chat-model fallback.

First successful batch: 20 independent Choice questions for 10 warnings, separating engineering severity from ownership/disposition. Rubric: not-a-finding, nit, minor, major, critical. Disposition: dismiss, nonblocking warning, out-of-plan, in-plan-needs-work, insufficient evidence. Supplied exact plan/source excerpts, branch scope, prior iteration, and warning allegations as hypotheses rather than authority.

Focused clarification: four questions separating minor-nonblocking, minor-in-plan, major-in-plan, dismiss, unresolved. It included the explicit distinction between a runtime defect and missing required behavioral verification.

Initial requests explicitly naming `typesafe/jev-latest` returned HTTP 400. The same native tool without that explicit model override succeeded, returning `jev-1.13.0`. Cause of the HTTP 400 was not diagnosed; no successful Jev setup was repeated.

Probabilities below are winning-label probabilities, not calibrated probabilities of a real defect. Confidence is Jev's separate distribution-derived value. Low confidence and conflicting calls remain visible.

## Results

| Warning | Jev severity/disposition | Winning probability | Confidence | Evidence and action |
|---|---|---:|---:|---|
| Static category allowlist | Major, in-plan | 0.97 (focused combined question) | 0.96 | Plan step 3 requires active slugs from `categories`. `remember.ts:5-15,89-96` uses migration-seeded constants, never category status. `columns.ts:70,123-124` lists static slugs. A seeded slug moved to `candidate` remains accepted; a newly active slug is rejected. Fix status lookup and active-slug fix generation inside the tool. This is a source-supported scenario, not live-DB reproduction. |
| Retry/idempotency verification | Major, in-plan verification gap | 0.82 (focused combined question) | 0.77 | `remember.test.ts:169-190` starts with a stubbed existing id; it never performs two identical calls. `:235-258` unconditionally returns no source-key match and increments insert IDs, so it does not prove distinct persisted source keys. Correction linkage `:260-285` runs once. Plan criterion 127 and risk validation path 77 require actual repeated-call proof with one stored row/id. Add stateful identical fresh/correction retry coverage. This is not proof the runtime retry path is broken. |
| Missing-identity zero-write verification | Minor, in-plan verification gap | 0.68 (focused combined question) | 0.58 | Plan risk validation path 65 requires a throwing git runner and zero inserts. `remember.test.ts:192-204` asserts rejection only; identity tests cover missing email/origin without a pool. `remember.ts:76-79` orders identity before pool calls, but that does not replace the explicitly required zero-write assertion. Exercise missing email/origin and runner failure with a command log. |
| Explicit retry-collapse documentation | Minor, probably nonblocking; uncertain | 0.49 (focused combined question) | 0.37 | Plan mitigation says document collapse; plan itself explains it, but docs remember bullet and tool card do not state it explicitly. Focused alternatives: minor-in-plan 0.36, dismiss 0.11, major-in-plan 0.03, unresolved 0.01. Earlier probe classified it in-plan with confidence 0.99; full-context call chose dismiss with confidence 0.34. Do not present a settled blocker/nonblocker judgment for this item. One explicit sentence removes the ambiguity. |
| Concurrent `max(seq)+1` | Major, out-of-plan | severity 0.79; disposition 1.00 | severity 0.74; disposition 0.99 | `remember.ts:149-176,202`. Plan explicitly selected allocation and completed iteration line 38 defers concurrency. Duplicate seq is plausible; there is no `(project,seq)` unique constraint, so the previous standards claim of a 23505 failure is unsupported. Separate follow-up plan. |
| Repeated remember advice | Nit, nonblocking | severity 0.92; disposition 0.99 | severity 0.90; disposition 0.97 | `columns.ts:102-130`. Optional style cleanup, not required for this plan. |
| Raw driver error messages | Not demonstrated as a new defect; uncertain | not-a-finding 0.38; dismiss 0.53 | severity 0.24; disposition 0.40 | `index.ts:163-193` preserves baseline raw error.message behavior; no actual secret-bearing error was shown. Severity alternatives minor 0.33, major 0.23, nit 0.05, critical 0.01. No proven security blocker; do not claim messages are universally safe. |
| Alleged previousId source-key bypass | Not a finding; dismiss | severity 0.90; disposition 0.95 | severity 0.88; disposition 0.94 | `remember.ts:103-105` looks up the source key before branching on previousId; key includes previousId at 65. Retraction of standards allegation stands. Missing retry verification is a separate finding. |
| Alleged unused subject | Not a finding; dismiss | severity 0.60; disposition 0.89 | severity 0.50; disposition 0.85 | `remember.ts:118-119` persists subject as initial project name, matching `sql-save.ts:141-145`. ON CONFLICT preserving that name is not an ignored argument. |
| Alleged docs line-11 contradiction | Not a finding; dismiss | severity 0.94; disposition 0.97 | severity 0.92; disposition 0.96 | Actual line 11 addresses Jev recall approval, not an obsolete SQL-op shape. |

## Disposition

**The previous Pass-with-warnings judgment was too permissive.** Native Jev identifies explicit in-plan gaps: active-category enforcement and required behavioral verification. Current plan disposition is **Needs work**, not immediate save/commit readiness.

Next: `/b-iterate` for active-category handling, stateful identical-retry proof, and missing-identity zero-write proof; then `/b-review` against the same plan. No runtime fix was applied in this assessment. Keep concurrent sequence allocation in its explicitly deferred follow-up. Optional collapse-doc clarification can be one sentence; Jev's ownership judgment for that warning is unstable and is not needed to establish the other in-plan gaps.
