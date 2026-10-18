---
status: completed
phase: 1
order: 1
plan: plan-buck-loop-model-config.md
phases_overview: plan-buck-loop-model-config-phases.md
difficulty: hard
model_hint: strongest reasoning model available; precedence and non-destructive YAML writes are failure-sensitive
buck_hint: /b-build-hard
goal: "Provide a lossless, deterministic source of active Buck profile stages and available candidates."
files: [extensions/omp-models.ts, extensions/omp-models.test.ts, package.json, package-lock.json]
from_plan_steps: [1, 2]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] Project active name wins; blank project active falls through to the user-global active name; missing or unknown names stop with the name in the error."
  - "[x] A project stage wins even when its models list is empty; an omitted project stage falls through to the same user-global profile stage."
  - "[x] Missing stages and zero candidates after availability filtering stop with the stage and excluded ids in the error."
  - "[x] Parsed stages preserve ids, optional notes, and optional thinking; omitted thinking resolves to off; unknown stage keys are ignored."
  - "[x] Writing either config scope preserves unrelated YAML keys, including modelRoles, and round-trips buckModels."
  - "[x] Existing parseModelRoles and mappingFromOmpRoles behavior remains green."
completed_at: 2026-09-23
completed_by: null
---

# Phase 1: Profile Config and Resolution

## Context

Parent user goal: an engineer switches a named profile that maps Buck stage groups to model-id sets and thinking levels instead of inheriting one phase-wide role chain.

This phase creates the load-bearing config boundary without changing any runtime caller. Project config is `<cwd>/.omp/config.yml`; global config is `${OMP_AGENT_DIR:-~/.omp/agent}/config.yml`.

## Implementation Details

1. Add typed `buckModels` profile/stage structures and the exact twelve-key stage vocabulary to `extensions/omp-models.ts`. Unknown keys remain inert.
2. Parse project and global documents independently. Keep the existing `modelRoles` parser and exports unchanged.
3. Resolve the active profile name, then one stage using project-then-global fallthrough. Presence is based on the stage key, not list length.
4. Filter configured ids against an injected/current OMP model-id set without mutating parsed or saved configuration.
5. Return structured success/stop results and format actionable stop messages for missing active name, unknown profile, missing stage, and no available candidates.
6. Add a lossless read-modify-write path for either scope. Use a real YAML document parser; add `yaml` as a direct dependency rather than relying on its transitive installation. Preserve unrelated document keys.
7. Build one behavioral test at a time through public resolver/writer seams. Include a regression run for existing role parsing.

## Risks

- Empty and omitted stages have different semantics. Test key presence explicitly.
- A partial serializer can erase unrelated OMP settings. Parse and update the full document.
- Availability filtering must never rewrite portable saved ids.
- Do not migrate `modelRoles` to the Settings API in this phase.

## Verification

- Focused Vitest: `npx vitest run extensions/omp-models.test.ts --reporter=verbose`.
- Throwaway filesystem smoke: write a config containing an unrelated key and `modelRoles`, update one profile, reread, and observe all keys plus ids/notes/thinking.
- Run the deterministic guardrails contract before completion.

## Per-Phase Execution Loop

1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this file.
3. Run `/b-iterate` only for in-plan review findings, then review again; route out-of-plan work to a separate plan.
4. Run `/b-docs` only if review identifies living-documentation impact.
5. Run `/b-save`, then `/b-commit`; one completed phase equals one commit.
6. If interrupted, leave `status: in-progress` and unchecked criteria for resume.
