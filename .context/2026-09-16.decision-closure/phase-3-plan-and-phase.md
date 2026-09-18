---
status: pending
phase: 3
order: 3
plan: plan-decision-closure-protocol.md
phases_overview: plan-decision-closure-protocol-phases.md
difficulty: medium
model_hint: capable general model — two core workflow skills, shared assumption IDs, no new frontmatter keys
buck_hint: /b-build
goal: "Make plans emit a status-bearing assumptions ledger only when triggered, and make phasing assign every deferred or blocking assumption to exactly one earliest-capable phase."
files:
  - skills/b-plan/SKILL.md
  - skills/b-phase/SKILL.md
  - plugins/buck-workflow/skills/b-plan/
  - plugins/buck-workflow/skills/b-phase/
from_plan_steps: [3, 4]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `b-plan` loads the shared protocol and runs the closure check after draft/Light Grill evaluation and before the final plan write."
  - "[ ] Low-risk plans omit Decision Closure, Assumptions Ledger, and structured material-risk sections; Light Grill stays discretionary."
  - "[ ] When a trigger applies, the plan includes assumption IDs with allowed statuses, blocking flags, validation paths, and material-risk rows (failure mode, impact, mitigation, rollback/fallback)."
  - "[ ] `b-plan` constructs its own ledger when upstream grill closeout is absent or incomplete; it does not fail closed on missing grill records."
  - "[ ] Confirmed problem reframing is recorded in the plan when it occurred; silent problem substitution is forbidden."
  - "[ ] `b-phase` maps each deferred or blocking assumption ID to exactly one earliest phase that can validate it, states that validation in the phase Context and acceptance criteria, and adds a HARD dependency when later work cannot proceed safely without resolution."
  - "[ ] Canonical `b-plan` and `b-phase` directories match their Codex bundle copies."
  - "[ ] Changed files contain no forbidden-term match and no donor sentence/table/template/label."
completed_at: null
completed_by: null
---

# Phase 3: Plan and Phase

## Context

Parent user goal: Buck Workflow users can see and validate material decisions, assumptions, and rollback posture before autonomous execution, without slowing routine work.

Phase 1 owns field names and statuses. This phase is the planning envelope: `b-plan` writes the ledger; `b-phase` schedules validation. Independent of grill skill edits (Phase 2). Soft-related to Phase 4, which consumes the same IDs at build/review time — do not invent extra ledger fields here.

## Implementation Details

### `b-plan`

1. Load `skills/_shared/decision-closure.md`. Cite headings; do not duplicate the schema.

2. Insert the closure check **after** draft / Light Grill evaluation and **before** the final plan write. If no trigger applies and evidence is sufficient, write the plan as today — no extra interview, no ledger sections.

3. When a trigger applies, add optional recommended-structure sections (names may match the protocol headings):

   - Decision Closure
   - Assumptions Ledger (`A-<n>` or the ID format frozen in Phase 1; status; blocking; evidence or validation path)
   - Structured material-risk entries (failure mode, impact, mitigation, rollback/fallback)

4. If a grill closeout exists, reuse its IDs and statuses. If it is missing or thin, synthesize the ledger from current evidence. Ask the user only for unresolved material questions.

5. If planning discovers a problem-framing mismatch, stop for explicit confirmation and record both framings.

6. Keep existing `b-plan` behavior: Light Grill discretionary, OMP eval-cell template, subject resolution, user-goal rules.

### `b-phase`

1. Load the same protocol.

2. After grouping steps, walk the parent plan's Assumptions Ledger (or equivalent closeout). For each `deferred` or blocking assumption, assign it to **exactly one** earliest phase that can validate it.

3. In that phase file: restate the assumption ID in Context; add an acceptance criterion that names the validation; if later phases cannot proceed safely, set `depends_on` / `dependency_type: HARD` accordingly.

4. Do not spread one assumption across multiple phases. Do not drop a blocking assumption on the floor. Non-blocking deferred items may be warnings in a later phase only if the earliest-capable phase still owns the validation.

5. Preserve existing phasing machinery (difficulty, `buck_hint`, overview matrix, backlog items, `omp_execution` omitted-by-default).

### Bundle

Synchronize full canonical `skills/b-plan/` and `skills/b-phase/` into `plugins/buck-workflow/skills/`. `diff -rq` must be clean.

## Risks

- Forcing ledgers onto every plan. The skip path is part of the user goal; include a mental smoke: a typo-fix plan has no new sections.
- ID mismatch between plan and phase. Use the Phase 1 ID format only.
- `b-phase` treating every assumption as HARD. Only block when later work is unsafe without resolution.
- Running in parallel with Phase 4: Phase 4 may assume these section names. If you rename headings, update the protocol (Phase 1) first — do not fork names in `b-plan` alone.

## Verification

- Read the updated `b-plan` recommended structure: new sections marked conditional.
- Trace one hypothetical `A-1` blocking migration assumption from a plan into a phase file's acceptance criteria and HARD dependency.
- Confirm Light Grill text is still discretionary.
- Bundle diffs clean; forbidden-term scan clean.
- Docs-only gate skip unless a non-markdown path changed.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
