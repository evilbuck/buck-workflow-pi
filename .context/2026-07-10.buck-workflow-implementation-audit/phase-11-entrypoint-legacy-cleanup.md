---
status: pending
phase: 11
order: 11
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; destructive surface retirement and legacy-state clean cutover
buck_hint: /b-build-hard
goal: "Expose only runnable entrypoints and finish the b-flow deprecation without compatibility shims."
files:
  - skills/b-auto-fix/**
  - skills/b-grill-auto/**
  - skills/b-blueprint/SKILL.md
  - prompts/b-blueprint.md
  - commands/b-blueprint.md
  - extensions/b-flow/**
  - docs/b-flow.md
  - .context/backlog/items/test-b-grill-auto-extension.md
from_plan_steps: [11]
depends_on: [6]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Incomplete b-auto-fix and b-grill-auto are absent from active skill discovery and runnable claims"
  - "[ ] Retained history is clearly archival and not a deprecated executable shim"
  - "[ ] /b-blueprint and /skill:b-blueprint both load the canonical blueprint skill"
  - "[ ] Live subject resolution no longer treats b-flow orchestration state as an owner"
  - "[ ] Retired b-grill-auto extension testing backlog is closed or archived honestly"
completed_at: null
completed_by: null
---

# Phase 11: Entry-point and Legacy Cleanup

## Context

**Inherited parent goal**: Buck Workflow users see only surfaces that actually execute their advertised contract.

`b-auto-fix` stages a pipeline but does not run it. `b-grill-auto` delegates to an unwired extension command; its checked-in `grill.py` currently fails `python3 -m py_compile` at line 144 because literal patch-marker `+` lines remain. `/b-blueprint` is advertised but unwired. b-flow is intentionally historical but retains live-looking fallbacks/source.

**Conservative decision**: retire `b-auto-fix` and `b-grill-auto` from active discovery in this remediation. Building safe autonomous GitHub and alternate-model executors is separate product work with materially larger runner/security contracts. Do not preserve aliases or no-op compatibility shims.

## Implementation Details

1. Before destructive removal, search package manifests, docs, install surfaces, and public repository references for verified external consumers. If a supported consumer exists, stop and create a separate recommission plan; do not ship a half-fix.
2. Remove or relocate `b-auto-fix` and `b-grill-auto` outside active `skills/` discovery. Git history and existing `.context` research preserve provenance; active docs must not call them runnable.
3. Remove/update their active tests and backlog assumptions consistently. Archive `test-b-grill-auto-extension.md` as obsolete rather than pretending its missing extension exists.
4. Add a thin `prompts/b-blueprint.md` and OMP command mirror; align the skill description so both `/b-blueprint` and `/skill:b-blueprint` are true.
5. Complete b-flow deprecation after Phase 6's resolver change:
   - remove live fallback assertions and active registration claims;
   - mark retained source/tests explicitly archival, or remove dead source if nothing consumes it;
   - keep `docs/b-flow.md` historical, not operational.
6. Do not touch the separate b-loop slash-mirror deferral.

## Risks

- **Destructive retirement**: deletion needs explicit evidence that no supported consumer depends on the surface. The default remains retirement; external dependency changes the task into a new plan.
- **Historical confusion**: history lives in Git and `.context`, not a discoverable deprecated skill directory.
- **Blueprint loader mismatch**: copy the repository's canonical thin wrapper/symlink pattern and verify both harnesses.
- **b-flow test dependency**: Phase 12 removes dead package dependencies only after active/archival boundaries are clear.

## Verification

- Active skill inventory excludes auto-fix/grill-auto; help/docs cannot invoke them as runnable.
- `python3 -m py_compile` failure is no longer exposed in an active skill surface.
- `/b-blueprint` resolves under Pi and OMP to the same canonical skill; `/skill:b-blueprint` remains valid.
- No active resolver or wire test treats `orchestration.json` as current ownership.
- Historical b-flow material, if retained, has an unmistakable archival boundary and no package registration.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only. Treat removal as the documented conservative plan decision; stop only on verified supported external consumers.
2. Run active-surface, blueprint-loader, and b-flow-resolution smokes.
3. Run `/b-review` against this exact phase file.
4. Iterate in-plan cleanup defects; any recommission request becomes a separate plan.
5. Run `/b-docs` because this phase necessarily changes documented surfaces.
6. Run `/b-save`, stage implementation and durable artifacts, then `/b-commit`.
7. Leave `status: in-progress` if any retired entrypoint remains advertised or discoverable.
