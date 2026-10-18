---
status: completed
date: 2026-09-18
updated: 2026-09-18
subject: 2026-09-18.buck-loop-extension
topics: [review, iteration, buck-loop, artifact-state]
informs: []
addresses: phase-2-artifact-state.md
completed: 2026-09-18
from_review: b-review
---

# Iteration: buck-loop Phase 2 artifact state (round 2)

## Source
- Reviewed after: `/b-iterate` (round 1 artifact `iterate-buck-loop-artifact-state.md`, completed 2026-09-18)
- Plan: `plan-buck-loop-extension.md`
- Phase: `phase-2-artifact-state.md`

## Critical Issues

### 1. Scanner treats completed iterate artifacts as active forever
- **File**: `extensions/buck-loop/scan.ts:268-270` (secondary: `scan.ts:325`)
- **Problem**: `hasIterate()` matches the `iterate-*.md` filename only and never reads frontmatter. `b-iterate` closes an artifact by setting `status: completed` and leaves the file on disk, so every later scan reports `reviewFacts.iterateArtifact: true`. The table then routes `reviewing → iterating` permanently (`table.ts:187-188`: "iterate artifact present; in-plan issues win") and `POSTCONDITION.iterating` (`scan.ts:325`) never reports `confirmed` while any iterate file exists. The supervisor burns its loop budget on phantom iterations until `maxLoops` blocks. This violates plan step 3, which scopes the fact to the **active** `iterate-*.md` artifact. Live evidence: this subject's own round-1 artifact (`iterate-buck-loop-artifact-state.md`, `status: completed`) is on disk right now and already trips the scan.
- **Proposed fix**: In `hasIterate()`, read each iterate artifact's frontmatter and count it only when its status is not `completed` (missing frontmatter stays active — fail-safe toward iterating, never silently skipping a possibly-open iteration). Add isolated fixtures for `status: active`, `status: completed`, and status-less iterate artifacts asserting `reviewFacts.iterateArtifact` and, for the iterating postcondition, `confirmed` once the artifact is completed.

## Warnings

### 1. Git-status failure is indistinguishable from a clean tree
- **File**: `extensions/buck-loop/scan.ts:370-371`
- **Problem**: `gitChangedFiles()` maps every `git status` error/timeout to `[]`, and `POSTCONDITION.committing` treats `changed.length === 0` as a confirmed commit. A failed observation would confirm a postcondition that was never checked.
- **Suggested approach**: Distinguish observation failure from an empty change set (e.g. return `null` on error) and map a failed observation to postcondition `pending`/`ambiguous` instead of `confirmed`.

### 2. Prototype properties pass the enum guards
- **File**: `extensions/buck-loop/persist.ts:218` and `extensions/buck-loop/persist.ts:248`
- **Problem**: `v in LOOP_STATES` / `v.kind in CHOICE_KINDS` accept inherited keys, so a hand-corrupted projection with `"state": "toString"` normalizes instead of being rejected as unreadable.
- **Suggested approach**: Use `Object.hasOwn(LOOP_STATES, v)` / `Object.hasOwn(CHOICE_KINDS, v.kind)`; add a fixture asserting a `"toString"` state blocks as an unreadable projection.

## Not actionable (reviewed, no change requested)
- Reconcile preserving a non-`done` projected state when the rescan yields `missing` facts is fail-safe: `table.ts:169-170` blocks any state whose `planFacts.kind === "missing"` ("plan unresolved"). No persist-side branch needed.
- Source-text contract tests (`scan.test.ts:457-461`, `persist.test.ts:207-211`) match the frozen Phase 1 convention (`table.test.ts:404-407`); keep consistent.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `phase-2-artifact-state.md`.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
