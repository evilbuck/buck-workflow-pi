---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-16.decision-closure
topics: [review, iteration, decision-closure]
informs: []
addresses: phase-2-shared-protocol.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Shared decision-closure protocol

## Source
- Reviewed after: `/b-build-hard`
- Plan: `plan-decision-closure-protocol.md`
- Phase: `phase-2-shared-protocol.md`

## Critical Issues

### 1. Require assumption IDs to be unique within the artifact
- **File**: `skills/_shared/decision-closure.md:42` (and `plugins/buck-workflow/skills/_shared/decision-closure.md:42`)
- **Problem**: The phase contract explicitly requires IDs unique within an artifact. The protocol says each ID is stable and uses `A-<n>`, but does not prohibit reusing the same ID for separate assumptions. In Phase 4, routing two distinct assumptions sharing an ID to one earliest-capable phase would make validation and blocking dependencies ambiguous.
- **Proposed fix**: State that each assumption gets a distinct ID within its artifact, retain stable cross-references, synchronize the complete `_shared` directory to the bundle, and verify parity. Do not add a new schema or frontmatter field.

## Warnings

None.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. Then re-run `/b-review` against `phase-2-shared-protocol.md`. Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.

## Resolution

- Each assumption now requires a distinct ID within its artifact; references keep that ID stable.
- Canonical and bundled protocol copies were updated together. Full `_shared` directory parity (`diff -rq`) passed, and the forbidden-term scan found no matches in the changed skill files.
- Docs-only iteration: deterministic code check skipped. Phase 2 re-review remains required before closeout.
