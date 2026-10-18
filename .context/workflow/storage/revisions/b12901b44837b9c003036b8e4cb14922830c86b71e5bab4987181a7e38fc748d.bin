---
status: active
date: 2026-10-03
subject: 2026-10-03.review-severity-ranking
topics: [review, ranking, parser, verification]
review_verdict: needs-work
phase: phase-1-types-scan-pure-waterline.md
---

# Plan Path Review: Phase 1 — Types, Scan, and the Pure Waterline

## Plan Source

- File: `phase-1-types-scan-pure-waterline.md`.
- Parent: `plan-review-severity-ranking.md`; linked research read for context. The current phase and parent plan take precedence over older research and recalled SQL decisions.
- Goal: establish inert ranking vocabulary, persistence compatibility, scan exclusions, issue parsing, and the pure waterline. No Jev call or routing cutover is required in this phase.
- Baseline: `b184c34ae00a686ac7410321b226951e24f6c30e`; staged implementation compared with that HEAD, then current source and executable behavior inspected. Recent unrelated commits were not treated as part of Phase 1.

## Evidence Sources

- Initial Git status: phase/overview and eight implementation/test files already staged; backlog change and planning/other-phase artifacts already unstaged or untracked. Those pre-existing changes were left alone.
- Recent relevant baseline commit: `b184c34 fix(buck-loop): dictate canonical subject in SQL save directive`. It introduced the now-failing subject assertion but did not change `sql-save.ts`.
- Modified implementation files reviewed: `extensions/buck-loop/{types,persist,scan,ranking,loop}.ts` and `extensions/buck-loop/__tests__/{persist,scan,ranking}.test.ts`.
- All seven phase-declared source/test files were inspected. `loop.ts` is an additional necessary file for the explicitly required `FROZEN_PHASE` change and is named by the parent plan.
- Canonical iteration template: `skills/b-review/SKILL.md:409–443`.
- Workflow pointer references a different subject and has no active `goal` field; the explicitly assigned phase governed this review.

## Completion Matrix

| Deliverable | Status | Current-state evidence |
|---|---|---|
| Ranking state, not a WorkState; rank effect | complete | `types.ts:36–54,204–209`; strict focused TypeScript check passed, asserting ranking membership, WorkState exclusion, and rank-effect membership. |
| Ranking persistence and old projections | complete | `persist.ts:25–38`; `persist.test.ts:64–82` passes for ranking and a literal pre-ranking version-1 projection. |
| Phase freezing, not an in-cycle skill | complete | `loop.ts:76–83,94–101`: ranking belongs only to FROZEN_PHASE, not IN_CYCLE_WORK_STATES. |
| Ignore completed, below-waterline, and ranking artifacts | complete | `scan.ts:349–354`; `scan.test.ts:331–355` passes for completed/below-waterline artifacts and a ranking file. A-3/A-7/A-9 behavior is evidenced. |
| Parser template, ordinal IDs, warning Suggested approach | partial | Canonical critical/warning fixture passes (`ranking.test.ts:4–42`), but `ranking.ts:52–55` silently drops title-plus-Problem issues when File/fix is missing; its section boundaries also admit unrelated sections. I-1/I-2 below. |
| Zero-issue scan defect and multiple-file blocked input | complete | `ranking.ts:18–29`; `ranking.test.ts:45–50` passes. Wiring these discriminants into machine routing is Phase 3, not missing Phase 1 work. |
| Pure waterline behavior | complete | `ranking.ts:90–107` matches all 25 plan cells; independent Bun smoke passed 300 matrix/scope/confidence combinations across absent, unknown, pre-existing, and regression classifications. Missing/non-finite answer probes also passed. |
| Required full-table unit-test coverage | partial | `ranking.test.ts:54–71` contains selected cells only; the full table, per-field missing answers, unknown regression, and rare/unlikely regression boundary remain absent from durable tests. I-3 below. |
| No choose or callChoiceModel dependency | complete | Full `ranking.ts:1–107` inspected: its sole import is node:fs; no model call exists. |
| Blocking/deferred assumptions for this phase | partial | No blocking assumptions are assigned here. A-9 and A-10 are evidenced; A-1's template parses, but issue admission/section boundaries need I-1/I-2. A-8/A-11 belong to later phases and were not reopened. |
| R-2 zero-parse mitigation and retained recovery path | complete | Zero-parse returns scan-defect, never an empty successful rank. The pre-cutover reviewing→iterating edge remains at `machine.ts:282–286`, with its recovery behavior asserted at `machine.test.ts:304–306`; that suite passed during the full guardrails unit run. No route has been cut over yet. |
| Required deterministic verification | missing | Two coherent `npm run guardrails:check` executions exited 1. Unchanged SQL-save subject assertion failed; coverage command also exited 1, so the runner could not obtain current coverage. This external gate blocker is O-1, not added to the Phase 1 iterate scope. |

## Review Axes

### Spec / acceptance-contract axis

Worst finding: **I-1 — admitted findings are silently dropped by extra parser requirements**, `ranking.ts:52–55`.

- Contract: phase Implementation Details requires title plus Problem.
- Reproduction: a complete `critical:1` followed by a titled issue with File and Problem but no Proposed fix returns only `critical:1`. Omitting File has the same result. A standalone title-plus-Problem issue instead becomes scan-defect.
- Consequence: mixed input bypasses the zero-issue safety condition and removes a finding before later ranking can consider it.
- Additional spec gap: I-3, required full-table unit-test coverage is incomplete even though independent current-state smoke passed.
- Axis verdict input: Needs work.

### Standards axis — explicitly scoped sequential fallback

No background sub-agent tool was available. A separate sequential standards pass followed acceptance-contract inspection. Seeds: TypeScript discriminated-union/type-narrowing/type-test guidance and the universal reuse/bounded-operation checklist from `code-review-universal`; diff-scoped Primitive Obsession, Dead Code, and Speculative Generality definitions from `code-smells`. No full-catalog audit or unrelated architecture redesign was performed.

Worst finding: **I-2 — Markdown sections are not bounded by peer headings**, `ranking.ts:68–74`.

- Reproduction: append `## Recommended Workflow` and a numbered subsection containing File, Problem, and Proposed fix after one critical issue. The parser returns two critical issues, including the workflow subsection.
- Consequence: content outside the accepted issue sections is treated as a finding.
- Fix: terminate recognized sections at the next peer/higher heading, not only the next recognized issue-section name; retain a behavioral regression fixture.
- The numeric severity matrix follows the accepted contract; it does not need an additional abstraction. The inert rank vocabulary is explicitly planned, not speculative generality. No style-only blocker was raised.
- Axis verdict input: Needs work.

Cross-axis ranking: none. Findings remain grouped by axis; I-1/I-2/I-3 are counted once each.

## Verification Status

- Phase goal achieved: partial — state/persistence/scan/waterline are evidenced; parser contract and requested unit-test coverage need repair.
- Parent user goal: intentionally not delivered yet. Phase 1 explicitly leaves Jev scoring and loop routing unchanged; those later phases are not defects in this review.
- Scope adhered: yes, with the necessary `loop.ts` freeze-set addition. The unused `readIssueFile()` helper is preparatory source-context work for the parent plan; it is not evidence of a live Jev integration.
- Out-of-scope cutover changes: none; machine edges, chooser behavior, b-review skill, site diagram, and skill-session execution were not changed.

### Executed checks

1. `npm run test:vitest -- extensions/buck-loop/__tests__/ranking.test.ts extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/persist.test.ts`: **3 files, 86 tests passed**.
2. Strict focused `tsc --ignoreConfig --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --skipLibCheck --types node --typeRoots ./node_modules/@types` on a temporary type-contract probe and `ranking.ts`: **exit 0**. This is not a claim that the whole project type-checks.
3. Standalone Bun smoke imported actual `ranking.ts`: **300 matrix/gate combinations passed**, plus missing/non-finite input checks and a complete template including a backtick-delimited File. Parser probes reproduced I-1/I-2 with the exact outputs described above. No network/model calls.
4. `npm run guardrails:check`, twice on the coherent unchanged implementation: **exit 1 both times**. Final unit run: **1 failed, 1480 passed, 6 skipped across 89 test files**.

No live CLI/TUI claim is made: the phase intentionally adds no reachable ranking route. The standalone module smoke exercised the changed pure surface; existing scan/persistence tests exercised disk-facing behavior.

## Guardrails Verdict

- Contract: durable.
- Contract version: 2; runner version: 1.0.0.
- Status: **fail**.
- Gates: `unit_test_gate=fail`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=advisory`, `global_ratchet=fail`, `complexity_gate=pass`.
- Current coverage: unavailable (`null`), because the coverage command exited 1; recorded baseline: 84. This is not evidence of a measured coverage regression.
- Patch coverage: unavailable; threshold 90; advisory enforcement.
- Complexity: 30 baseline hotspots retained; no new violations or hard-ceiling violations.
- No contract, baseline, ignore, implementation, or test was modified by this review.

## User Goal Analysis

- Goal: the operator avoids iterate cycles for findings below the severity waterline, retaining their record.
- Met in this phase: deterministic waterline calculation, compatible state/effect vocabulary, scan skip status, and explicit malformed/multiple-artifact input variants.
- Partial: issue extraction still loses contracted findings and misidentifies unrelated section content.
- Missing by design: Jev ranking, audit writes, artifact rewrite, and ranking-state routes; allocated to Phases 2–3, with user-facing docs in Phase 4.
- Verdict: Phase 1 partially met; no whole-plan completion claim.

## Documentation Impact

No documentation impact.

Phase 1 does not introduce a user-facing route. Parent-plan diagram/review-exit documentation remains assigned to Phase 4; this review does not pull it into Phase 1.

## How-to Impact

No how-to impact.

No new command, keybinding, or operator sequence is introduced by this inert phase.

## Issue Classification

- **In-plan:** I-1 extra File/fix admission gates discard findings; I-2 section boundaries include non-issue sections; I-3 full-table/missing-answer unit-test coverage is incomplete. Fix proposals are in `iterate-phase-1-types-scan-pure-waterline.md`.
- **Out-of-plan:** O-1, pre-existing SQL-save contract failure at `extensions/buck-loop/__tests__/sql-save.test.ts:91`. The test expects `subject: <canonical-subject>\n`, while `sql-save.ts:80–93` emits no subject line. `git diff b184c34 --` for those two files was empty, and the baseline commit's stat shows the test assertion addition without a corresponding implementation change. This finding is not in the iteration artifact and does not itself change the Phase 1 correctness verdict. It independently prevents required-check closeout until repaired under separate scope or explicitly overridden.

## Completion Audit

1. Concrete deliverables restated from this phase, not from later phases.
2. Each deliverable mapped to source, tests, or executable output above.
3. Current source inspected; deterministic contract executed rather than trusting completed checkboxes.
4. Verification matched inert module/disk behavior; no unsupported UI or Jev claims.
5. Parser/test gaps and unavailable coverage recorded as incomplete, not passed.
6. Both review axes completed; no unfinished pass is represented as approval.

## Verdict

**Needs work** — three in-plan findings (two parser defects and one required test-coverage gap). Required repository checks also fail for an independently identified pre-existing reason.

## Recommended Next Step

For the supervisor's consideration: apply the bounded Phase 1 iteration and re-review this exact phase. Keep O-1 outside that iteration scope; resolve the separate deterministic-check blocker or obtain a recorded explicit operator override before claiming closeout. The supervisor retains exclusive authority to select the next loop state.
