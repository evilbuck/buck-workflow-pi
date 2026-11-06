---
status: completed
date: 2026-09-22
updated: 2026-09-22
subject: 2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume
topics: [review, iteration]
informs: []
addresses: plan-fix-buck-loop-deferred-docs-and-in-cycle-resume.md
completed: 2026-09-22
from_review: b-review
---

# Iteration: Fix buck-loop deferred-docs and in-cycle resume

## Source
- Reviewed after: `/b-build-hard`
- Plan: `plan-fix-buck-loop-deferred-docs-and-in-cycle-resume.md`
- Spec: none

## Critical Issues

### 1. Cross-domain deferral wording can suppress the wrong impact flag
- **File**: `extensions/buck-loop/scan.ts:363-394`
- **Problem**: `NAMED_PHASE_DEFERRAL` accepts `documentation`, `living-document`, and `how-to` prefixes, then `hasCurrentImpact` applies that same expression to both impact sections. While Phase 2 is active, a Documentation Impact line of `How-to coverage is deferred to Phase 5.` therefore clears `docsImpact`; the inverse wording clears `howtoImpact`. The report remains parseable and can route directly to save even though the corresponding section never explicitly deferred its own work. This violates the fail-closed classifier and the requirement that affirmative, contradictory, or unrecognized current-impact text stay flagged.
- **Proposed fix**: Make named deferral matching domain-specific (documentation/living-document prefixes only for Documentation Impact; how-to prefixes only for How-to Impact), while retaining an explicitly allowed prefixless standalone `Deferred to Phase N` form because the enclosing section supplies the domain. Add exported `scan` regressions proving cross-domain prefixes remain flagged in both directions.

## Previous Resolution

- Anchored named-phase deferral recognition to standalone deferral statements. A line that also requires current work remains impact-positive.
- Converted `git add -A` failures at the in-cycle ownership boundary into a persisted `blocked` projection and structured `LoopResult`. The added `blocked → blocked` history record prevents a failed ownership mark from qualifying for the staged-resume exception.
- Bounded accepted no-impact statements to exact standalone forms plus the exact Teleport explanation. Arbitrary trailing clauses now remain impact-positive without relying on a conjunction allowlist.
- Added a public `scan` regression for contradictory suffixes with no conjunction.
- Added active-phase validation: phase-qualified no-impact wording must match the active phase, and named deferral must target a strictly later phase.

## Resolution

- Split named-phase deferral recognition by impact domain. Documentation sections accept only documentation/living-document prefixes; how-to sections accept only how-to prefixes.
- Preserved the prefixless standalone `Deferred to Phase N` form because the enclosing impact section supplies its domain.
- Added an exported `scan` regression proving both cross-domain prefix directions remain impact-positive.

## Verification

- Red regression: scanner suite failed because cross-domain prefixes cleared both impact flags.
- Focused scanner and supervisor suites: 2 files, 88 tests passed.
- Unit gate: 57 Vitest files with 935 tests passed; Bun gate: 2 files with 70 tests passed.
- Lint gate: disabled by `guardrails.json`.

## Current Review Status

- Independent `/b-review` passed with no in-plan defects after this iteration.
- The out-of-plan Git safety-probe failure mode is tracked separately in `.context/backlog/items/fail-closed-buck-loop-git-safety-probes.md`.

## Recommended Workflow

Supervisor owns the next loop state.
