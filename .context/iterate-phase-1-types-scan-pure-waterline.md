---
status: completed
date: 2026-10-03
updated: 2026-10-03
subject: 2026-10-03.review-severity-ranking
topics: [review, iteration, parser, ranking]
informs: []
addresses: phase-1-types-scan-pure-waterline.md
completed: 2026-10-03
from_review: b-review
---

# Iteration: Phase 1 types, scan, and pure waterline

## Source

- Reviewed after: `/b-build-hard`
- Phase: `phase-1-types-scan-pure-waterline.md`
- Parent plan: `plan-review-severity-ranking.md`
- Review: `review-phase-1-types-scan-pure-waterline.md`
- Baseline: `b184c34ae00a686ac7410321b226951e24f6c30e`, staged implementation plus current source.

## Critical Issues

### 1. Preserve findings meeting the contracted title-and-Problem minimum
- **File**: `extensions/buck-loop/ranking.ts`
- **Problem**: `parseIssues()` at lines 52–55 requires File and fix as well as title and Problem, although the phase's parser contract requires title plus a Problem bullet. A smoke fixture with one complete issue followed by a titled finding with a Problem but no Proposed fix returns only `critical:1`; the second finding is silently discarded. Omitting File has the same result. With only that finding, the parser reports a scan defect instead of an issue. The mixed case bypasses the zero-issue safeguard, leaving a real finding unavailable to the later ranking stage.
- **Proposed fix**: Use title and non-empty Problem as the issue-admission requirements. Retain File and fix when present, representing missing secondary fields explicitly (for example, empty strings in the existing string fields) rather than dropping the issue. Preserve heading ordinals. Add regression cases for mixed complete/incomplete secondary fields and the single title-plus-Problem issue, alongside rejection of missing title or Problem.

### 2. Stop issue sections at the next peer Markdown heading
- **File**: `extensions/buck-loop/ranking.ts`
- **Problem**: `sectionRanges()` at lines 68–74 ends a section only at the next Critical Issues or Warnings heading, not at the next arbitrary `##` heading. A smoke fixture containing a valid critical issue followed by `## Recommended Workflow` and an issue-shaped numbered subsection returns that workflow content as `critical:2`. The parser therefore admits content outside the two accepted issue sections into the ranking input.
- **Proposed fix**: Determine section boundaries using all peer or higher-level Markdown headings, then parse only the Critical Issues and Warnings ranges. Add a regression fixture with issue-shaped content under a subsequent unrelated section and assert it is excluded without losing the real issue.

## Warnings

### 1. Finish the explicitly required pure-waterline test table
- **File**: `extensions/buck-loop/__tests__/ranking.test.ts`
- **Problem**: Lines 54–71 test selected cells only, not the full impact-by-likelihood table required by Phase 1 Verification. Missing confidence is tested, but missing scope, impact, likelihood, unknown regression, and the rare/unlikely regression boundary are not covered. The review's independent smoke passed 300 matrix/scope/confidence combinations and missing/non-finite input checks, but those throwaway assertions do not supply the requested durable unit-test coverage.
- **Suggested approach**: Add deterministic table-driven assertions for the 25 impact/likelihood cells with regression, pre-existing, unknown, and absent regression classifications. Include both hard-gate exclusions with regression and each missing required answer. Assert outcomes from the accepted plan's table, not by deriving expectations from production implementation data.

## Recommended Workflow

These are in-plan findings only. Apply them through `/b-iterate`, then re-run `/b-review` against `phase-1-types-scan-pure-waterline.md`.

The repository-wide deterministic check also failed on an unchanged SQL-save contract test. That out-of-plan finding is documented only in the review report, not included in this iteration's fix scope. A passing required check or an explicit operator override is needed before closeout; do not weaken the contract or delete the test to bypass it.

The supervisor owns loop-state selection, re-review, save, and commit. This iteration completes when its assigned fixes are applied and verified; its completion does not waive required quality gates.

## Implementation evidence (2026-10-03)

All three assigned findings are addressed in the current worktree:

- I-1: `parseIssues()` admits title plus non-empty Problem. Missing File/fix becomes an empty string; rejected headings still occupy their original ordinal. Horizontal-only issue-heading whitespace prevents an empty title from consuming the next bullet as its title.
- I-2: section ranges terminate at the next peer or higher Markdown heading, including unrelated workflow sections.
- I-3: permanent tests cover all 25 impact/likelihood cells for regression, pre-existing, unknown, and absent regression; every case also checks the scope and confidence gates. Missing required answers, non-finite confidence, invalid scores, standalone minimum findings, mixed findings, and peer/higher boundaries are covered.

Verification after the code edits:

- `npm run test:vitest -- extensions/buck-loop/__tests__/ranking.test.ts extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/persist.test.ts`: 3 files, 203 tests passed.
- Strict focused TypeScript check of `ranking.ts` and `ranking.test.ts`: exit 0.
- Bun smoke imported the actual module and parsed this real iteration artifact: exactly `critical:1`, `critical:2`, `warning:1`; rare major regression routes above the waterline, while unknown regression does not.
- Contract lint is disabled (`lint_cmd: null`). Coverage, patch, and complexity were not rerun for this bounded iteration. The known unchanged SQL-save unit failure was not rerun merely to reconfirm it.

Only `ranking.ts`, `ranking.test.ts`, this artifact, `execution-phase-1-iteration.md`, and the subject commit draft were modified by this assignment. Pre-existing source/planning/backlog changes and the unrelated stale workflow/memory pointer were preserved.

Assigned iteration completed. Re-review (`review-zz-phase-1-rereview-2026-10-03.md`) confirms no remaining in-plan findings. The unrelated SQL-save required-gate failure still blocks full phase closeout; no override was granted. No loop state, phase status, subject lifecycle, or unrelated SQL-save implementation was changed.
