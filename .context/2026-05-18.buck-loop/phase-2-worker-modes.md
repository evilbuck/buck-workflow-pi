---
status: completed
phase: 2
order: 2
plan: plan-autonomous-b-flow-loop.md
phases_overview: plan-autonomous-b-flow-loop-phases.md
difficulty: medium
model_hint: "Capable general model preferred; prompt/audit contracts require cross-file awareness but are bounded."
buck_hint: /b-build
goal: "Teach the b-flow worker layer to run build, review, iterate, and save modes with explicit prompts, expected results, and audit metadata."
files: ["extensions/b-flow/worker.ts", "extensions/b-flow/types.ts", "skills/b-build/SKILL.md", "skills/b-review/SKILL.md", "skills/b-iterate/SKILL.md", "extensions/b-flow/__tests__/machine.test.ts"]
from_plan_steps: [5, 11]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] runWorker accepts an explicit WorkerMode and any mode-specific input path without breaking existing callers."
  - "[x] Worker prompts explicitly load/follow the correct Buck skill for build, review, iterate, and save-equivalent behavior."
  - "[x] Expected result frontmatter is documented in the generated prompt for each mode."
  - "[x] Worker audit files include mode, child pid, chunk id, start time, and result path."
  - "[x] Tests or fixtures verify each mode's prompt/audit contract."
completed_at: 2026-05-18
completed_by: b-build
---

# Phase 2: Worker Modes and Prompt Contracts

## Context

After Phase 1 defines the shared contracts, the worker layer can become command-specific. This phase should remain focused on worker invocation, prompts, expected result metadata, and audit records. It should not yet implement the full autonomous lifecycle state machine.

## Implementation Details

1. In `extensions/b-flow/worker.ts`, change `runWorker(chunk, options)` to accept a `mode` and any mode-specific input path required by that mode.
2. Preserve compatibility at current call sites by adapting them intentionally rather than leaving implicit defaults.
3. Build prompts that explicitly load/follow the appropriate Buck workflow instructions:
   - `build`: `skills/b-build/SKILL.md` or hard-variant behavior for difficult phases.
   - `review`: `skills/b-review/SKILL.md` with the phase/plan acceptance contract.
   - `iterate`: `skills/b-iterate/SKILL.md` with the active iterate artifact.
   - `save`: current save workflow instructions or a minimal save-equivalent contract if no dedicated `b-save` skill exists.
4. Include expected result frontmatter per mode so later parsing can be deterministic.
5. Record worker audit metadata: mode, child pid, chunk id, started time, and result path.
6. Expose enough process metadata for later STOP/recovery handling, but defer full cancellation behavior to Phase 4.
7. Add tests or fixtures proving each mode generates the expected instructions and audit fields.

## Risks

- Save mode may expose a missing `b-save` skill/command contract. Mitigate by documenting and testing a minimal save-equivalent prompt contract.
- Prompt changes can be brittle if tests assert exact prose. Prefer tests for required sections/fields/skill references.
- Existing worker callers may still expect a generic chunk worker. Update call sites or provide a narrow compatibility adapter.

## Verification

Run targeted worker/prompt tests first, then b-flow tests:

```bash
npm test -- extensions/b-flow
```

Confirm tests check for required mode names, skill references, expected result fields, and audit metadata rather than incidental wording.
