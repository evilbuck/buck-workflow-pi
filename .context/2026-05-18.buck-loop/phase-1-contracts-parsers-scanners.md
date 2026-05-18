---
status: completed
phase: 1
order: 1
plan: plan-autonomous-b-flow-loop.md
phases_overview: plan-autonomous-b-flow-loop-phases.md
difficulty: medium
model_hint: "Capable general model preferred; contract work spans several b-flow modules but should stay deterministic and well-tested."
buck_hint: /b-build
goal: "Establish the typed contracts, result parsing, iterate scanning, and queue filtering needed by the autonomous phase lifecycle."
files: ["extensions/b-flow/types.ts", "extensions/b-flow/verify-result.ts", "extensions/b-flow/scan-context.ts", "extensions/b-flow/queue-builder.ts", "extensions/b-flow/__tests__/scan-context.test.ts", "extensions/b-flow/__tests__/machine.test.ts"]
from_plan_steps: [1, 2, 3, 4, 11]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] WorkerMode and active orchestration/projection fields are typed and backward-compatible with existing orchestration.json files."
  - "[x] Review result parsing distinguishes pass, issues-with-iterate, requires-replan, and malformed/blocking results."
  - "[x] Active iterate scanning finds exactly one active phase-scoped iterate artifact, ignores completed artifacts, and records conflict metadata for multiples."
  - "[x] Queue building no longer queues stale completed iterate artifacts as independent chunks."
  - "[x] Targeted parser, scan-context, and queue-builder tests cover the new contracts."
completed_at: 2026-05-18
completed_by: b-build
---

# Phase 1: Contracts, Parsers, and Scanners

## Context

This phase creates the stable artifact and type contracts that every later autonomous-loop phase depends on. It should not yet refactor the lifecycle actor or wire autonomous execution; it only defines how worker modes, review results, active iterate artifacts, and queue eligibility are represented.

## Implementation Details

1. In `extensions/b-flow/types.ts`, add the shared autonomous-loop contracts:
   - `WorkerMode = "build" | "review" | "iterate" | "save"`.
   - `RouteAction.spawn-worker.mode` should use `WorkerMode`.
   - Add per-queue-item `iterations[]` history.
   - Add `OrchestrationState.active` with `chunkId`, `phasePath`, `step`, `iteration`, `maxIterations`, optional `workerPid`, optional `lastResultFile`, and optional `issueFingerprint`.
   - Add review outcome and active iterate metadata types.
2. Keep schema migration tolerant. Existing `orchestration.json` files without new fields must still load.
3. In `extensions/b-flow/verify-result.ts` or a small adjacent module, parse review-specific fields:
   - `mode`
   - `review_passed`
   - `issues_found`
   - `requires_replan`
   - `iterate_file`
   - `issue_fingerprint`
4. Treat missing or inconsistent review fields as a blocking parse result, not as success. Preserve existing behavior for non-review results.
5. In `extensions/b-flow/scan-context.ts`, extend scanning to inspect subject-folder `iterate-*.md` files and parse `status`, `phase`, `iteration`, `source_review_result`, and `issue_fingerprint`.
6. Populate `artifacts.activeIterate` only when exactly one `status: active` iterate file matches the active phase.
7. Record conflict metadata when multiple active iterate files match; do not pick one silently.
8. In `extensions/b-flow/queue-builder.ts`, remove or narrow the current behavior that queues all `iterate-*.md` files. Completed iterate files must not become fresh pending queue items.
9. Add or update focused tests for parser, scan-context, and queue-builder contracts.

## Risks

- Type changes can accidentally make old orchestration state unreadable. Mitigate with backward-compatibility tests or fixtures.
- Review result frontmatter may be inconsistent with current worker output. Treat ambiguity as blocking and document the expected fields in tests.
- Phase matching for iterate artifacts must be exact enough to avoid consuming another phase's work.

## Verification

Run the narrowest relevant tests first, using the closest supported test filter:

```bash
npm test -- extensions/b-flow/__tests__/scan-context.test.ts
npm test -- extensions/b-flow
```

Also inspect or add parser/queue-builder tests if they live outside the existing test files.
