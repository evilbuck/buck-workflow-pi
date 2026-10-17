---
status: completed
phase: 2
order: 2
plan: plan-jev-tool.md
phases_overview: plan-jev-tool-phases.md
difficulty: hard
model_hint: strongest reasoning model available — this phase separates two similarly named difficulty domains while changing runtime parsing and model routing across shared consumers
buck_hint: /b-build-hard
goal: "Cut phase-file difficulty to hard or not-hard across runtime consumers without changing three-tier code-review Hardness."
files:
  - extensions/omp-models.ts
  - extensions/omp-models.test.ts
  - extensions/index.ts
  - extensions/buck-mode.test.ts
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/__tests__/loop.test.ts
from_plan_steps: [4, 5, 6]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] `PhaseDifficulty` is a separate `hard | not-hard` domain with parsing and tier-mapping helpers; review `DifficultyTier` remains `easy | medium | hard`."
  - "[x] New phase values parse directly, legacy `easy | medium` parse as `not-hard`, and absent/unknown values default to `not-hard`."
  - "[x] Model auto-switch maps phase `hard` to the hard tier and `not-hard` to the medium tier while preserving the Phase 1 Jev registration."
  - "[x] buck-loop reads binary phase difficulty, keeps its `DifficultyTier` run-step API, and applies the same legacy/default behavior."
  - "[x] Focused parser, model-routing, root-extension, and buck-loop tests pass; code-review-iteration Hardness behavior is unchanged."
completed_at: 2026-09-21
completed_by: b-build-hard
---

# Phase 2: Binary Difficulty Cutover

## Context

Parent user goal: Engineers using OMP can offload “is this phase hard?” to Jev while the main model still designs phases, and the generic registered tool remains reusable for later classifications.

Phase 1 registered the Jev tool and established the final `extensions/index.ts` baseline. This phase changes the runtime phase-file domain from three values to two while leaving the independently meaningful code-review Hardness domain untouched.

## Implementation Details

1. In `extensions/omp-models.ts`, introduce a dedicated `PhaseDifficulty = "hard" | "not-hard"` type and helpers:
   - `parsePhaseDifficulty(...)` recognizes `hard` and `not-hard`;
   - legacy `easy` and `medium` become `not-hard`;
   - missing or unknown values default to `not-hard` at the consumer boundary;
   - `phaseDifficultyToTier(...)` maps `hard` → `hard`, `not-hard` → `medium`.
2. Keep `DifficultyTier`, `OmpModelMapping`, `DIFFICULTY_TO_ROLE`, and `mappingFromOmpRoles` three-tier. They are still used by code-review-iteration review Hardness and must not be renamed or collapsed.
3. In `extensions/index.ts`, replace the inline `easy|medium|hard` phase regex and state typing with the new helpers. Preserve every Phase 1 Jev import/wire and all unrelated extension registration.
4. In `extensions/buck-loop/loop.ts`, make `readDifficulty`/`difficultyOf` return `PhaseDifficulty`, default `not-hard`, and map through `phaseDifficultyToTier` before calling the unchanged `runStep` API.
5. Add or update focused tests for:
   - `hard` and `not-hard`;
   - legacy `easy` and `medium` tolerance;
   - absent and unknown frontmatter;
   - model auto-switch tier selection;
   - buck-loop run-step tier mapping;
   - explicit separation from review Hardness.

Do not rewrite historical phase files. Do not modify code-review-iteration’s `Hardness` model-selection contract.

## Risks

- **Domain collision:** Both concepts currently share three-tier helpers. Mitigation: a separate exported `PhaseDifficulty` type and explicit conversion at runtime boundaries.
- **Legacy regression:** Existing phase files contain `easy` and `medium`. Mitigation: treat both as `not-hard`; cover that contract in both root-extension and buck-loop paths.
- **Shared-file overwrite:** This phase edits `extensions/index.ts` after Phase 1. Mitigation: preserve and test the Jev wire while replacing only phase parsing/state.
- **Silent default drift:** Missing metadata previously selected medium. Mitigation: `not-hard` maps to the same medium model tier, preserving runtime cost/quality behavior.

## Verification

- Run `npx vitest run extensions/omp-models.test.ts extensions/buck-mode.test.ts extensions/buck-loop/__tests__/loop.test.ts`.
- Exercise representative frontmatter values through both root auto-switch and buck-loop difficulty paths; observe `hard` → hard tier and all non-hard/legacy/default cases → medium tier.
- Search live phase parsing for stale `easy|medium|hard` regexes, excluding the review-Hardness domain.
- Run the relevant code-review model-registry tests to prove three-tier review Hardness remains intact.
- Run `npm run guardrails:check` at the completed edit checkpoint.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), route them to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the next session resumes here.
