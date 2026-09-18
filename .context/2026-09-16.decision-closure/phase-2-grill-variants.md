---
status: pending
phase: 2
order: 2
plan: plan-decision-closure-protocol.md
phases_overview: plan-decision-closure-protocol-phases.md
difficulty: medium
model_hint: capable general model — four skill bodies, one shared closeout contract, no runtime changes
buck_hint: /b-build
goal: "Wire all four portable grill skills to load the shared protocol and emit one consistent closeout section without duplicating its schema."
files:
  - skills/b-grill/SKILL.md
  - skills/b-grill-me/SKILL.md
  - skills/b-grill-auto/SKILL.md
  - skills/b-grill-with-docs/SKILL.md
  - plugins/buck-workflow/skills/b-grill/
  - plugins/buck-workflow/skills/b-grill-me/
  - plugins/buck-workflow/skills/b-grill-with-docs/
from_plan_steps: [2]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `b-grill`, `b-grill-me`, `b-grill-auto`, and `b-grill-with-docs` each instruct the agent to load `skills/_shared/decision-closure.md` (or `skill://_shared/decision-closure.md`)."
  - "[ ] None of the four skills restate the full trigger/status/risk schema; they point at the shared headings and add only skill-specific application notes."
  - "[ ] All four preserve existing question/domain/phasing metadata behavior, including Light Grill remaining discretionary in `b-grill` / `b-plan`."
  - "[ ] Closeout is one consistent section shape: selected course, evidence, assumptions, blocking/validation, material risk, excluded scope, next bounded action — omitted entirely when no material trigger applies and evidence already suffices."
  - "[ ] Confirmed problem reframing and pressure calibration are applied in all four variants."
  - "[ ] `extensions/b-grill-auto/` is untouched. No new machine-readable field that would force a runtime serializer change."
  - "[ ] Canonical `b-grill`, `b-grill-me`, and `b-grill-with-docs` directories match their Codex bundle copies. `b-grill-auto` is not added to the bundle."
  - "[ ] Changed canonical grill skills and their Codex mirrors contain no forbidden-term match and no donor sentence/table/template/label."
completed_at: null
completed_by: null
---

# Phase 2: Grill Variants

## Context

Parent user goal: Buck Workflow users can see and validate material decisions, assumptions, and rollback posture before autonomous execution, without slowing routine work.

Phase 1 froze the schema. This phase is the intake surface: grilling must produce a native closeout when material, and stay quiet when not. `b-plan` (Phase 3) is required to tolerate missing upstream closeout, so this phase is not a blocker for plan/phase/build/review authoring.

## Implementation Details

1. Load Phase 1's protocol. Cite its headings; do not paste its field list into each skill.

2. Update all four portable grill skills:

   - `skills/b-grill/SKILL.md` — both modes (full grill and Light Grill). Light Grill stays discretionary. When Light Grill runs and a material trigger applies, still perform the closure *check*; ask only if evidence and prior decisions cannot resolve it.
   - `skills/b-grill-me/SKILL.md` — user-mode sessions get the same closeout contract.
   - `skills/b-grill-auto/SKILL.md` — model-assisted sessions get the same portable, body-based closeout. Do not change `extensions/b-grill-auto/`. If auto output cannot fill every field, say so and leave synthesis to `b-plan`.
   - `skills/b-grill-with-docs/SKILL.md` — same closure contract; keep domain-doc / CONTEXT / ADR behavior intact.

3. Add one closeout section (name it consistently across the four files) that instantiates the shared record. Preserve existing grill metadata that `b-phase` already consumes (`decision_domains`, `boundary_assessment`, `break_points`, deferred/blocked questions).

4. Apply pressure calibration: do not add questions that the protocol's skip path would forbid. Apply confirmed reframing: mismatch → user confirmation → record both framings.

5. Do not edit prompt/command wrappers. They remain thin loaders.

6. Synchronize full canonical directories for the three curated bundle skills (`b-grill`, `b-grill-me`, `b-grill-with-docs`) into `plugins/buck-workflow/skills/`. Do **not** create `plugins/buck-workflow/skills/b-grill-auto/`.

7. Forbidden-term scan on the four canonical skills and the three bundled copies. Originality review against the source discussion named in the parent plan — concept-level only.

## Risks

- Four slightly different closeout sections. Write the application notes so a later reader sees one contract.
- `b-grill-auto` over-reaching into the extension. Portable skill text only.
- Light Grill becoming mandatory because closure was naively bolted onto every path.
- Bundle accidentally gaining a `b-grill-auto` directory.

## Verification

- Grep the four skills for `decision-closure.md`; each hits. Grep for copied status/trigger tables; expect none.
- Light Grill language still discretionary.
- `diff -rq` clean for the three bundled grill directories; no bundled `b-grill-auto`.
- `extensions/b-grill-auto/` unchanged (`git diff` empty).
- Forbidden-term scan clean.
- Docs-only gate skip unless a non-markdown path changed.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
