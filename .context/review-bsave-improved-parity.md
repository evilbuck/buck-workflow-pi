---
status: completed
date: 2026-08-27
subject: 2026-08-26.deterministic-bsave
topics: [review, b-save-improved, parity, guardrails]
related:
  - plan-bsave-improved-parity.md
  - ../../backlog/items/complexity-burn-down.md
  - ../../memory/guardrails-override-complexity-2026-08-27.md
verdict: pass-with-warnings
---

# Review: b-save-improved artifact parity with b-save

## Plan Source

- File: `.context/2026-08-26.deterministic-bsave/plan-bsave-improved-parity.md`
- Goal: deterministic `/b-save-improved` records retain the readable shape and cross-reference fidelity of `/b-save`.
- Baseline: current uncommitted diff atop `8d0f1cb`; source-state verification used because the branch contains older unrelated commits.

## Completion Matrix

| Step | Status | Evidence |
|---|---|---|
| 1. Pin first user message | ✅ complete | `extensions/b-save-improved/index.ts:145-195`; cap-truncation tests at `extensions/b-save-improved/__tests__/wire.test.ts:108-134` |
| 2. Land auditor evidence | ✅ complete | payload at `extensions/b-save-improved/index.ts:477-480`; deterministic insertion/idempotency at `skills/b-save-improved/scripts/save-apply.ts:111-160`; golden assertion at `wire.test.ts:399-400` |
| 3. Stitch spec cross-references | ✅ complete | preflight reads `spec:` at `save-preflight.ts:223-232`; payload crossrefs/spec-plans at `index.ts:447-480`; apply at `save-apply.ts:175-200` |
| 4. Append missing subject-index sections | ✅ complete | `save-apply.ts:315-375`; existing headings preserved and missing sections appended by tested exact-heading checks |
| 5. Include bash digest activity | ✅ complete | `index.ts:117-136`; whitespace and 120-char behavior tested at `wire.test.ts:136-150` |
| 6. Golden parity fixture | ✅ complete | preflight→payload→apply fixture at `wire.test.ts:335-442`, including re-run idempotency |
| 7. Existing suite stays green | ✅ complete | fresh durable guardrails unit gate exit 0; 427 Vitest tests plus the package's Bun leg under `npm test` |

## Verification Status

- Goal achieved: yes.
- User goal: met — memory headings/evidence, two-line memory-index entry, subject-index synopsis, and plan↔spec links are asserted cold from disk by the golden fixture.
- Scope adhered: yes. Code changes stay within the plan's affected files; `.context` changes are workflow artifacts.
- Dry-run smoke: synthetic plan/spec checkpoint produced memory, subject-index, memory-index, plan-memory, spec-memory, and spec-plan actions; before/after checksums were identical (`NO_WRITES_CONFIRMED`).
- Additional edge probe: CRLF headings did not duplicate Verification/What shipped/Related sections.

## Guardrails Verdict

- Contract: durable, version 2.
- Raw status: **fail**.
- Gates: `unit_test_gate=pass`, `functional_test_gate=skipped`, `lint_gate=skipped`, `patch_gate=pass` (90.79% ≥ 90), `global_ratchet=pass` (70.01% vs 54.9 baseline), `complexity_gate=fail`.
- Complexity failure: five new and one worsened hotspot that pre-date this review/build diff. None of the parity functions changed by this plan remain above CCN 10 after the build refactor.
- Override: explicitly approved by the user on 2026-08-27 and recorded in `.context/memory/guardrails-override-complexity-2026-08-27.md`.

## User Goal Analysis

- Goal: `/b-save-improved` produces records as rich and readable cold as `/b-save` without losing deterministic mechanics.
- Met: all seven canonical memory headings, evidence, normalized index shape, subject-index sections, and spec/plan links are observable in the golden fixture.
- Partial: none.
- Missing: none.
- Verdict: met.

## Documentation Impact

No living-documentation impact. The implementation's canonical contract was updated in `skills/b-save-improved/SKILL.md`; no architecture decision, domain language, or public workflow changed outside that skill.

## Issue Classification

- In-plan issues (implementation defects → `/b-iterate`): none.
- Out-of-plan issues (fresh `/b-plan`): pre-existing repository complexity inventory drift, already tracked at `.context/backlog/items/complexity-burn-down.md`.

## Verdict

**Pass with warnings.** The plan's work is complete and current-state behavior is directly verified. The raw repository guardrails verdict remains fail solely on pre-existing complexity; the user-approved override permits closing this plan while the separate burn-down item remains active.

## Recommended Next Step

Close accepted work with `/b-save` → `/b-commit`. Then start a fresh `/b-plan` → `/b-build` cycle for `.context/backlog/items/complexity-burn-down.md` when ready.
