---
status: completed
date: 2026-10-03
updated: 2026-10-03
subject: 2026-10-03.review-severity-ranking
topics: [review, iteration, ranking]
informs: []
addresses: phase-2-jev-ranking-core.md
completed: 2026-10-03
from_review: b-review
---

# Iteration: Phase 2 Jev ranking core

## Source

- Reviewed after: `/b-build-hard`
- Phase: `phase-2-jev-ranking-core.md`
- Plan: `plan-review-severity-ranking.md`, step 3; phase acceptance criteria are authoritative.
- Baseline: `8f8c51132e8b77173d31d1ee664359ae87952635` plus current staged implementation. Pre-existing staged implementation and unstaged phase metadata were not changed by this review.
- Acceptance axis reviewed first. Standards axis used the explicitly scoped sequential fallback because this session exposes no sub-agent dispatch tool. Seeds: `code-review-universal/reference/typescript.md`, `reference/code-quality-universal.md`; `code-smells/docs/{duplicate-code,primitive-obsession,long-method}.md`. No cross-axis ranking.
- Focused verification: `npx vitest run extensions/buck-loop/__tests__/ranking.test.ts` — 129 passed.
- Callable smoke: actual `rankIssues()` with default filesystem reads/writes in temporary directories; mixed above/below filtering through `runJev(createTypeSafeEvaluator({ createClient: injectedClient }))`; retry success, retry exhaustion, missing File bullet, audit write failure, padded and repeated headings. No network or live Jev call. Temporary scripts and fixtures removed after the review.

## Critical Issues

### 1. A parser-accepted issue without a File bullet silently falls below the waterline
- **File**: `extensions/buck-loop/ranking.ts`
- **Problem**: `parseIssues()` accepts a title and Problem alone and sets `file: ""` (lines 58–65; existing parser tests at ranking.test.ts:121–126 establish this input). `rankIssues()` sets `fileText` to null but only creates the missing-file failure when `issue.file` is truthy (lines 182–187). It therefore makes zero judge calls, records no failure, sets `above: false`, and marks the artifact below-waterline when this is the only finding. The phase requires missing-file context to be a Jev failure, not an unscored skip. Callable smoke reproduced all four outcomes.
- **Proposed fix**: Treat absent File metadata as unavailable source context, using the same failure/routing policy as an unavailable named file; never silently turn it into a scored below-waterline issue. Keep title-plus-Problem parsing intact. Add a regression covering parse → rank → audit → iterate status for a finding without File metadata.

### 2. Parser and rewrite disagree on issue identity and can drop an above-waterline finding
- **File**: `extensions/buck-loop/ranking.ts`
- **Problem**: The new parser derives ids with `Number(headings[i][1])` (line 60), but rewrite looks up the unnormalized heading string (line 350). A heading `### 01. Above issue` parses as `critical:1`, ranks above, then is removed from the iterate artifact. Repeated `### 1.` headings both parse as `critical:1`; an above and below pair shares the keep-set key, so both survive. Both cases were reproduced with default real filesystem writes. This violates the exact retained-findings invariant and R-3; writing the audit first does not prevent the lost finding.
- **Proposed fix**: Use one canonical identity rule in parsing and rewriting, preserving stable ids after filtering. Detect ambiguous duplicate ids and block rather than merging distinct findings; alternatively use an unambiguous identity scheme consistent with the accepted section-ordinal contract. Add regressions for padded heading numbers and repeated numbers, asserting exact surviving parsed ids and findings, not title substrings alone.

## Warnings

### 1. Retry failure history is discarded or omitted from the retained issue
- **File**: `extensions/buck-loop/ranking.ts`
- **Problem**: Successful retries clear `failure` at line 197, and `firstFailure` is not carried into `RankedIssue` or the audit (lines 202–215). Exhausted retries retain a note in the audit, but `rewriteIterate()` only filters original issue blocks and never adds the required Jev-failed/re-review-with-Jev note (lines 319–355). Callable smoke reproduced missing history in the recovered result/audit/iterate, and missing issue annotation after two thrown calls. The phase's third criterion and implementation detail 2 require the first failure to be noted on the issue. The existing retry-success test explicitly expects no audit failure note (ranking.test.ts:289–298), contrary to that contract.
- **Suggested approach**: Separate historical failure information from the final routing decision. Preserve the first failure even when retry succeeds, retain final raw answers, record the history in the audit, and annotate retained affected iterate findings with the Jev failure and re-review instruction without altering their stable ids. Replace the contradictory retry-success assertion with consumer-visible failure-history behavior coverage. Also add the phase's two-issue case where a required answer is missing for only one issue, so retry isolation is verified rather than inferred from the loop.

## Axis Results

- Spec axis worst finding: Critical issue 1 — a valid parser input silently bypasses the required failure routing.
- Standards axis worst finding: Critical issue 2 — inconsistent and ambiguous string identity causes data loss or incorrect retention; evidence from the sequential standards smoke.
- Warning 1 is an acceptance-contract defect, not documentation impact.
- No broad refactor is requested. Fix these local invariants in the existing module and tests; loop wiring remains Phase 3 work.

## Recommended Workflow

Start with `/b-iterate` for this phase only, then re-run `/b-review` against `phase-2-jev-ranking-core.md`.
Inside an OMP execution session, `/b-iterate` completes this artifact before it returns; the supervisor then re-reviews. Do not leave it active waiting for review or save.
This artifact records only in-plan implementation defects. Repository-wide deterministic verification is reported separately to the supervisor; this artifact does not authorize changes to adjacent SQL-save code or any loop-state decision.

## Resolution and verification

- Missing File metadata now follows unavailable-source failure routing: retained above-waterline, with audit and issue annotations.
- Padded heading numbers use the parser's numeric identity during rewrite. Duplicate canonical ids block parsing and direct ranking before judgment or persistence.
- Retry history survives recovery without changing the recovered waterline decision; retained affected findings carry the first failure and re-review-with-Jev instruction. Missing-answer retry isolation is covered across two issues.
- `npx vitest run extensions/buck-loop/__tests__/ranking.test.ts`: 134 passed.
- Scoped TypeScript check with `--ignoreConfig --noEmit --skipLibCheck --module nodenext --target es2022`: passed.
- Baseline mutation check against the pre-iteration staged implementation: seven relevant tests failed for missing annotations/history, missing-source routing, padded identity, duplicate ids, and retry isolation history.
- Callable filesystem smoke: actual `rankIssues()` retained a missing-source padded finding as `critical:1`, persisted audit and issue failure evidence, and left status active. No live Jev call.
- Temporary mutation modules, tests, smoke fixtures, and proof script removed.
- Repository completion remains blocked by the review-reported required SQL-save unit failure. Not rerun to confirm an already-reported failure; no SQL-save changes or gate override. Lint is disabled with null commands in the durable contract. Coverage/patch/complexity are outside this light iteration checkpoint.
- This completion status closes the three assigned ranking defects only; it does not close the phase or authorize a loop-state transition. Supervisor owns re-review, save, and commit.
