---
status: pending
phase: 3
order: 3
plan: plan-jev-tool.md
phases_overview: plan-jev-tool-phases.md
difficulty: medium
model_hint: capable general model preferred — runtime contracts are established, but the canonical skill, bundled copy, documentation, and external-service smoke must agree exactly
buck_hint: /b-build
goal: "Make b-phase batch one Jev Noul per phase, stamp auditable binary difficulty, and prove the complete workflow."
files:
  - skills/b-phase/SKILL.md
  - plugins/buck-workflow/skills/b-phase/SKILL.md
  - docs/buck-workflow.md
  - docs/extension-loading.md
from_plan_steps: [7, 8, 9]
depends_on: [1, 2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `b-phase` makes exactly one Jev call with one Noul per designed phase, using stable `phase_<n>_hard` question ids and the hard rubric."
  - "[ ] Noul `>= 0.7` stamps `difficulty: hard` and `/b-build-hard`; lower values stamp `not-hard` and `/b-build`; every scored phase records `hard_noul`."
  - "[ ] Tool unavailability or failure triggers the skill’s own binary judgment and a visible `not Jev-scored` note; failure is never presented as a Jev score."
  - "[ ] Canonical and Codex-bundled `b-phase` skills are byte-identical; templates, summaries, and examples contain no stale three-tier phase rubric."
  - "[ ] `docs/buck-workflow.md` and `docs/extension-loading.md` describe the registered tool, two-way phase difficulty, legacy tolerance, threshold, and fallback accurately."
  - "[ ] A real-key toy Noul and a real small-plan `b-phase` run prove the registered tool and stamped `difficulty`, `hard_noul`, and `buck_hint`; focused tests and guardrails pass."
completed_at: null
completed_by: null
---

# Phase 3: b-phase Integration and Proof

## Context

Parent user goal: Engineers using OMP can offload “is this phase hard?” to Jev while the main model still designs phases, and the generic registered tool remains reusable for later classifications.

Phases 1 and 2 establish the tool and binary runtime domain. This phase changes the human/agent workflow, synchronizes the Codex bundle and living docs, and proves the full path with the real TypeSafe service.

## Implementation Details

1. Rewrite the phase-difficulty section in `skills/b-phase/SKILL.md` around one binary hard rubric. The main model still designs all phases before scoring.
2. After phase design, issue exactly one `jev` call containing one Noul question per phase:
   - question id: `phase_<n>_hard`;
   - instructions: `Is this phase hard?`;
   - criteria: the skill’s hard rubric, grounded in each phase’s files, ambiguity, blast radius, and verification burden.
3. Apply the consumer-owned threshold:
   - Noul `>= 0.7`: `difficulty: hard`, `buck_hint: /b-build-hard`;
   - Noul `< 0.7`: `difficulty: not-hard`, `buck_hint: /b-build`;
   - write the raw probability as `hard_noul:` in each scored phase frontmatter.
4. If the tool is unavailable or errors, judge each phase locally with the same binary rubric and add a visible `not Jev-scored` note. Do not invent a `hard_noul` value and do not call another model as Jev fallback.
5. Update every affected `b-phase` template, summary table, difficulty-mix example, model hint, backlog pickup example, and SKIP/PHASE example from three-tier to binary. Preserve the existing dependency and per-phase execution contracts.
6. Recopy the canonical skill to `plugins/buck-workflow/skills/b-phase/SKILL.md`; do not hand-edit the bundled copy independently.
7. Update `docs/buck-workflow.md` with the binary schema, `>= 0.7` decision, legacy tolerance, model-tier mapping, and fallback note. Update `docs/extension-loading.md` with the `jev` extension/tool registration and fail-closed behavior.
8. Run live proof with a real `TYPESAFE_API_KEY`:
   - call `jev` with a toy Noul and inspect `answers`, `model`, and `usage`;
   - run `b-phase` on a small plan;
   - inspect the generated phase files and confirm `difficulty`, `hard_noul`, and `buck_hint` came from the returned scores.

Keep the eval twin, buck-loop chooser migration, and “is this mechanical?” recovery question out of scope.

## Risks

- **Skill/runtime mismatch:** Prose may stamp fields the runtime does not parse. Mitigation: this phase starts only after Phase 2 and uses its exact schema.
- **False audit trail:** Fallback judgment could look Jev-scored. Mitigation: omit `hard_noul` and write `not Jev-scored` visibly on every fallback output.
- **Bundle drift:** Canonical-only edits fail Codex packaging. Mitigation: recopy the complete skill and verify byte identity.
- **External proof unavailable:** Missing credentials block the real smoke acceptance criterion. Mitigation: finish all local work and tests, but do not mark this phase complete until the registered real-key path is observed.
- **Stale examples:** The skill is large and repeats difficulty in templates/examples. Mitigation: search all canonical, bundled, and living-doc phase-difficulty prose after editing.

## Verification

- Run focused Jev, phase-parser, model-routing, buck-loop, skill-frontmatter, and Codex bundle tests.
- Compare `skills/b-phase` and `plugins/buck-workflow/skills/b-phase` byte-for-byte.
- Search the canonical/bundled skill and live docs for stale three-tier **phase** difficulty language while excluding review Hardness.
- With a real key, call the registered tool for a toy Noul and record the observed full response shape.
- Run the updated `b-phase` on a small plan and inspect every generated phase frontmatter for score/threshold consistency.
- Run `npm run guardrails:check` at the completed edit checkpoint.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), route them to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the next session resumes here.
