---
status: completed
date: 2026-10-16
subject: 2026-10-16.buck-loop-restart-test-fingerprint
topics: [review, buck-loop, extension-restart]
review_verdict: approve
addresses: plan-restart-test-fingerprint.md
---

# Plan Path Review: Ignore test-only buck-loop edits in the restart gate

## Plan Source

- File: `plan-restart-test-fingerprint.md`.
- Goal: test-only retry/diagnose repairs continue; non-test supervisor repairs still require a fresh OMP process.
- Baseline: working tree against HEAD `d58be4c`. The user explicitly selected this plan, not the earlier Jev-halt implementation.
- Scope boundary: only the fingerprint filter, its two new diagnose regressions, and the opening paragraph of the repair-resume how-to are reviewed. Other changes in the same working tree belong to the earlier halt/diagnose work and are not covered by this approval.

## Evidence Sources

- Git status: 13 modified tracked files and two untracked subject folders; no staged diff at discovery.
- Relevant baseline commits: `d58be4c` (PR #64 merge), `844cd62` (NUL-delimited status/recovery paths), `8ad8d28` (stop reason and claimed-file staging).
- Plan affected files verified: `extensions/buck-loop/ambiguity.ts`, `extensions/buck-loop/__tests__/loop.test.ts`, `docs/howto/resume-buck-loop-after-repair.md`.
- Current source inspected at both fingerprint consumers: `extensions/buck-loop/loop.ts:934-968,1046-1090`; process-local gate: `loop.ts:251-264`.
- Independent standards review: `FingerprintStandards`, separate reviewer context, no edits or checks.
- Deterministic measurement: `FingerprintGuardrails`; actual output independently read from `/tmp/guard.out` and `/tmp/loop.out`.
- No SQL recall was called, following the b-review stage restriction. No live storage-adapter process was resumed or changed.

## Completion Matrix

| Deliverable | Status | Direct current-state evidence |
|---|---|---|
| User goal: preserve test-only repair and continue | Complete | `loop.test.ts:913-938` changes test files, lands scanner proof, reaches `done`, and exercises same-process resume/start without a restart reason. Focused suite passes. |
| Step 1: subtract test paths only | Complete | `ambiguity.ts:204-220` prunes `__tests__` before recursion and excludes test/spec TS, JS, MJS, TSX, JSX suffixes before reading/hashing. The existing before/after comparison remains at lines 224-228. |
| Step 2: test-only diagnose regression and rescan | Complete | `loop.test.ts:913-938`; `loop.ts:948-968` falls through to `finishDiagnose` and scanner verification when the filtered change set is empty. |
| Step 3: mixed-diff restart and same-process refusal | Complete | `loop.test.ts:941-962` requires blocked state, restart reason naming `touched.ts`, and identical refusal for resume/start. `loop.ts:261-264` returns before dispatch when gated. |
| Step 4: existing runtime restart regressions unchanged | Complete | Exact comparison against HEAD confirmed the pre-existing-dirt, dirty `prior.ts` repair, and `touched.ts` restart cases are unchanged; current locations `loop.test.ts:841-910`. Focused suite passes. |
| Step 5: how-to distinguishes tests from loaded code | Complete | `docs/howto/resume-buck-loop-after-repair.md:3` states the non-test rule and test exclusions. |
| Step 6: focused suite and required gates | Complete | Focused Vitest: 129 passed, 5 skipped, exit 0. Durable v2 guardrails: pass, required unit/ratchet/complexity gates pass. |
| A-1: no runtime import of excluded tests | Complete | Import/path search under `extensions/buck-loop` found only `index.test.ts:8` importing test fixtures; remaining matches are fixture path strings in the new tests. No runtime test-module import found. |
| A-2: mixed changes cannot hide runtime repair | Complete validation; recorded ledger status unchanged | Mixed-diff regression passes; direct import smoke returns only `extensions/buck-loop/runtime.ts` after simultaneous runtime and test additions/edits. Plan retains its original `deferred`, non-blocking metadata; review does not rewrite it. |
| Material risk: stale loaded module misclassified as test | Complete for accepted mitigation | Filter is limited to named test directories/suffixes. Existing runtime refusal tests pass unchanged. Direct smoke detects runtime edits/deletion and keeps Markdown/JSON in the fingerprint. Runtime code must continue to stay outside test paths. |
| Rollback/fallback availability | Complete by source-state inspection and retained regression path | The original hash traversal/comparison remains at `ambiguity.ts:205-228`; reverting the directory/suffix exclusion restores all-file fingerprinting. Runtime restart and process-local refusal paths remain exercised. No live rollback was performed. |
| Scope and exclusions | Complete | Scoped implementation matches all three affected files. Earlier halt changes are explicitly excluded from this approval, not treated as new scope violations. Live-loop recovery, restart wording/gate changes, and Markdown/JSON exclusion were not added by this fix. |

## Review Axes

- **Spec axis worst finding:** no behavioral defect; non-blocking documentation overclaim: the how-to and draft message say `*.test.*` / `*.spec.*`, while the filter recognizes only TS/JS/MJS/TSX/JSX suffixes.
- **Standards axis worst finding:** the independent reviewer found none. Subsequent parent review noted a cosmetic JSDoc attachment issue: the function comment now attaches to `TEST_BASENAME` (`ambiguity.ts:203-205`). Neither warning establishes a runtime defect.
- Standards guides: `code-review-universal/reference/typescript.md`, `reference/code-quality-universal.md`; diff-scoped code-smells references: duplicate code, primitive obsession, dead code. No broad smell audit.
- Cross-axis ranking: none. Each axis assessed independently.

## Verification Status

- Goal achieved: yes, within the selected plan.
- User goal: met; test-only diagnose repair reaches completion while mixed/runtime repairs retain the restart gate.
- Scope adhered: yes for this plan; other working-tree implementation remains unreviewed here.
- Out-of-scope changes introduced by this fix: none found.
- Direct runtime smoke: imported the real `ambiguity.ts` implementation with Bun and exercised disposable on-disk files, then removed the temporary tree. Observed four passing checks: test-only additions excluded; mixed runtime change retained; Markdown/JSON edits retained; runtime deletion detected. Nested `__tests__` and test/spec TS/JS/MJS/TSX/JSX paths were included.
- Focused command: `npx vitest run extensions/buck-loop/__tests__/loop.test.ts` — 129 passed, 5 skipped, exit 0. The run printed a Git fixture diagnostic and an npm configuration warning; neither caused a failure.
- No live OMP restart or storage-adapter recovery was attempted; both are explicitly outside the plan.

## Guardrails Verdict

- Command: `npm run guardrails:check`, exit 0.
- Contract: durable, version 2; runner 1.0.0.
- Status: **pass**.
- Gates: unit_test_gate=pass; functional_test_gate=skipped; lint_gate=skipped; patch_gate=advisory; global_ratchet=pass; complexity_gate=pass.
- Enforcement: unit, global ratchet, complexity required; patch advisory; lint and functional disabled.
- Coverage: 89.4%, baseline 84%, target 90%. Patch coverage was unavailable (`null`); the advisory patch gate does not establish changed-line coverage.
- Complexity: 30 existing hotspots, no new violations or hard-ceiling violations.
- Diagnostics: none. Proposed coverage baseline increase was not applied.

## User Goal Analysis

- Goal: an operator whose diagnose-and-fix session edits only buck-loop tests keeps the repair and continues; loaded supervisor edits still stop until OMP restarts.
- Met: test-only continuation, scanner rescan, no process-local test-only gate, mixed/runtime restart protection, existing pre-existing-dirt behavior, documentation distinction.
- Partial: none.
- Missing: none within scope.
- Verdict: met.

## Documentation Impact

Non-blocking wording correction: narrow the how-to and draft-commit description to the implemented test suffixes rather than broadening behavior beyond the accepted plan. Route living-document wording through `/b-docs`; refresh the draft during `/b-save`. This is documentation impact, not an implementation defect or a reason to create an iteration artifact.

## How-to Impact

The existing how-to covers the recovery action, but its test-suffix wording needs the documentation correction above. No new procedure is required.

## Issue Classification

- In-plan behavioral implementation defects: none. No iteration artifact created; documentation impact remains non-blocking.
- Documentation warning: the how-to and draft message overstate the excluded suffix set. Cosmetic warning: the fingerprint JSDoc attaches to the regex constant.
- Integration/commit warning: the new regressions depend on the uncommitted Jev-halt diagnose path (`loop.ts:948-951`). The fingerprint change is not independently shippable against HEAD. Review and land the prerequisite first, or review both and commit them together; file-scoped staging alone does not establish a valid boundary.
- Separate-review follow-up: assess the earlier halt plan's persistence claims and coverage in its own review. No persistence defect was established here; `persist.test.ts` being unchanged is not proof of missing behavioral coverage.
- Verification caveats: advisory patch coverage unavailable; five focused tests skipped. Required checks passed.

## Completion Audit

1. Objective restated as test-only continuation plus preserved runtime restart safety.
2. Every acceptance criterion maps to current source, regression cases, or command evidence above.
3. Actual implementation inspected and authoritative deterministic contract executed.
4. Fingerprint behavior exercised directly; loop behavior exercised through public `handleLoop` regressions with real scanner/persistence and controlled child work.
5. Unavailable patch coverage and unexercised live recovery are explicitly not claimed.
6. Review complete for the selected plan; earlier halt/diagnose implementation remains excluded.

## Verdict

**Pass with warnings** — no behavioral defects established in the selected fingerprint fix. Documentation wording and cosmetic warnings are non-blocking. This is not approval to ship the combined working tree; the unreviewed Jev-halt prerequisite must be addressed at the commit boundary.

## Recommended Next Step

Next run `/b-review .context/2026-10-16.buck-loop-jev-halt-diagnose/plan-diagnose-halt.md`. If that review finds implementation defects, run `/b-iterate` against its findings. Otherwise correct the documented suffix wording (`/b-docs`), then `/b-save` → `/b-commit`. Review and commit the halt prerequisite first, or review both and commit together; do not commit the fingerprint tests without the diagnose implementation they exercise.
