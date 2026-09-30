---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-16.decision-closure
topics: [review, iteration]
informs: []
addresses: phase-4-plan-and-phase.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Plan and Phase Decision Closure

## Source
- Reviewed after: `/b-build`
- Plan: `plan-decision-closure-protocol.md`
- Phase: `phase-4-plan-and-phase.md`

## Critical Issues

### 1. Material triggers may silently lose their closure record
- **File**: `skills/b-plan/SKILL.md:244-252` and `plugins/buck-workflow/skills/b-plan/SKILL.md`
- **Problem**: The first branch tells the planner to omit closure sections if a triggered decision is already settled by evidence. The next paragraph says triggered sections "may" be included. A migration plan with a confirmed approach can therefore omit its decision, assumption IDs, evidence, material risk, and recovery path altogether, despite the Phase 4 criterion requiring the record when a trigger applies and the shared protocol requiring a triggered closeout record.
- **Proposed fix**: Keep the skip branch for no-trigger routine work only. For every material trigger, record the selected course and evidence, any applicable assumptions with stable IDs and required fields, material risks with recovery validation, excluded scope, and next action, without forcing an interview when prior decisions suffice. Make the conditional structure's inclusion rule unambiguous; keep canonical and bundled skills identical.

## Warnings

### 1. Phasing ownership is duplicated in the planner
- **File**: `skills/b-plan/SKILL.md:256-260` and `skills/b-phase/SKILL.md:126-135`
- **Problem**: The added `b-plan` section instructs the planner to assign deferred assumption IDs to phases "before finalizing phases", although phase design and assignment are owned by `b-phase`. This second prescription can drift from Step 4b and implies that a non-phased plan must finalize phases.
- **Suggested approach**: Leave the ledger and validation path in `b-plan`; let `b-phase` exclusively assign validation ownership and dependencies, with a short cross-reference from planning if needed. Maintain bundle parity.

## Resolution

- Triggered plans now always include a decision-closure record even when the decision is already settled; only no-trigger work skips it. Applicable assumptions and material risks are recorded without fabricating empty rows or requiring another interview.
- Planning retains the ledger and validation paths; `b-phase` alone assigns phase validation ownership and dependencies.
- Canonical and bundled `b-plan`/`b-phase` directories match; Codex packaging tests pass (7/7). Re-review against Phase 4 remains the independent acceptance gate.

## Recommended Workflow

Start with `/b-iterate` on this phase and re-run `/b-review` against `phase-4-plan-and-phase.md`. In an OMP execution session, complete the artifact, obtain a passing review, and record durable state via `/b-save` before closing the phase.
