---
status: pending
phase: 3
order: 3
plan: plan-buck-loop-subject-picker.md
phases_overview: plan-buck-loop-subject-picker-phases.md
difficulty: easy
model_hint: smaller/faster general model is fine
buck_hint: /b-build
goal: "Update user-facing documentation for the no-path ranked picker: ADR, command references, and how-to classification."
omp_execution: none
files:
  - docs/adr/0002-observably-invoked-happy-path-loop.md
  - docs/extension-loading.md
  - docs/buck-workflow.md
  - docs/oh-my-pi.md
  - docs/howto/run-buck-loop.md
from_plan_steps: [8]
depends_on: [2]
dependency_type: SOFT
acceptance_criteria:
  - "[ ] ADR records that no-path invocation uses Jev only to rank and still requires an operator selection (no auto-start)."
  - "[ ] docs/extension-loading.md documents the optional path and ranked picker behavior."
  - "[ ] Remaining text in docs/buck-workflow.md / docs/oh-my-pi.md claiming a positional path is always required is corrected."
  - "[ ] How-to impact classified during /b-review; if positive, docs/howto/run-buck-loop.md covers the no-path selection procedure with numbered steps ending in an observable success check (via /b-howto)."
completed_at: null
completed_by: null
---

# Phase 3: Documentation

## Context

Parent plan User Goal: "When I run `/buck-loop` without a path, show me about ten likely subject folders ranked by probability; when I select one, start the loop on that subject."

Docs-only phase updating living documentation to match the Phase 2 behavior. SOFT dependency on Phase 2: content describes shipped behavior, so it lands last, but nothing blocks writing it except accuracy.

## Implementation Details

From plan step 8:

1. **ADR** — `docs/adr/0002-observably-invoked-happy-path-loop.md`: no-path invocation uses Jev only to rank; operator selection is still required; fail-closed on judgment failure.
2. **Command references** — `docs/extension-loading.md`: optional path + ranked picker. `docs/buck-workflow.md` / `docs/oh-my-pi.md`: correct any remaining "path required" text.
3. **How-to** — During `/b-review`, classify how-to impact; if positive run `/b-howto` for the no-path selection procedure with numbered steps ending in **Eat** (observable success check).

## Risks

- Drift between docs and shipped behavior → write after Phase 2 merges; verify claims against actual UI strings (`Choosing a subject`, `Starting <subject>`).

## Verification

- All doc claims match Phase 2 behavior and exact activity strings.
- `/b-review` documentation-impact classification resolved (updated or confirmed no impact).
