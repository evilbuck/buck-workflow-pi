---
status: pending
phase: 4
order: 4
plan: plan-decision-closure-protocol.md
phases_overview: plan-decision-closure-protocol-phases.md
difficulty: medium
model_hint: capable general model — execution-side consumers; watch for b-review overreach into plan-quality review
buck_hint: /b-build
goal: "Constrain hard-mode implementation choices with the minimal-change sequence, and extend review to check blocking assumptions and rollback evidence without reopening accepted decisions."
files:
  - skills/b-build/SKILL.md
  - skills/b-review/SKILL.md
  - plugins/buck-workflow/skills/b-build/
  - plugins/buck-workflow/skills/b-review/
from_plan_steps: [5, 6]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `b-build` hard mode loads the shared protocol and evaluates the minimal-change sequence before adding a dependency, abstraction, or broad refactor, stopping at the first option that safely satisfies the plan."
  - "[ ] Settled plan decisions are not reopened unless current evidence contradicts them; genuine reframing routes back to planning rather than silent scope change."
  - "[ ] Routine / non-hard `b-build` paths are unchanged — no per-edit approvals, file caps, or stub-first mandate."
  - "[ ] `b-review` completion matrix gains rows for: blocking assumptions resolved or still blocking; material rollback/fallback claims have current-state evidence."
  - "[ ] Unresolved in-plan blockers are implementation defects; non-blocking deferred assumptions are warnings; genuinely new scope uses the existing out-of-plan path."
  - "[ ] `b-review` remains an implementation review, not a plan-quality review."
  - "[ ] Canonical `b-build` and `b-review` directories match their Codex bundle copies."
  - "[ ] Changed files contain no forbidden-term match and no donor sentence/table/template/label."
completed_at: null
completed_by: null
---

# Phase 4: Build and Review

## Context

Parent user goal: Buck Workflow users can see and validate material decisions, assumptions, and rollback posture before autonomous execution, without slowing routine work.

Phase 1 owns the minimal-change sequence and closure-ready rules. This phase applies them at execution time. Soft-depends on Phase 3: review and hard-mode read plan/phase ledgers whose *shape* is in the protocol. You may implement against Phase 1 headings if Phase 3 has not landed; do not invent a second field vocabulary.

`b-build-hard` remains a mode of `b-build`. Do not change `skills/b-build-hard/SKILL.md` unless that wrapper currently bypasses hard-mode steps (if it only points at `b-build`, leave it).

## Implementation Details

### `b-build` hard mode

1. Load `skills/_shared/decision-closure.md`.

2. Add a hard-mode-only decision step that fires when the work would introduce a new dependency, a new abstraction, or a broad refactor. Walk the protocol's minimal-change sequence and stop at the first safe option that satisfies the plan. Record which option was chosen and why earlier options were insufficient.

3. Treat the plan's selected course as settled. Reopen it only with **current** contradictory evidence. If evidence shows the problem framing is wrong, stop and route back to planning / user confirmation — do not silently change scope.

4. Do not add: global per-edit approvals, rendered-diff checkpoints, file or line caps, mandatory stub-first work, or acceptance prompts after every change.

### `b-review`

1. Load the same protocol.

2. Extend the plan completion matrix (not a new review genre) with:

   - Every blocking assumption from the plan/phase ledger is resolved, or is reported as an in-plan implementation defect.
   - Every material rollback/fallback claim has current-state evidence, or is reported as an in-plan defect.
   - Non-blocking deferred assumptions → warnings, not defects.
   - New discoveries that are not in the plan → existing out-of-plan path (`/b-plan` → `/b-build`), not `/b-iterate`.

3. Do not score whether the plan chose the "right" architecture. Review checks that implementation honored the accepted envelope and that declared safety claims are evidenced.

### Bundle

Synchronize full canonical `skills/b-build/` and `skills/b-review/` into `plugins/buck-workflow/skills/`. `diff -rq` must be clean.

## Risks

- Review starts re-litigating accepted decisions. Limit new matrix rows to the plan's own blocking assumptions and declared rollback/fallback claims.
- Hard mode applies the sequence on every edit. Gate it on dependency / abstraction / broad-refactor introduction.
- Parallel with Phase 3: if ledger heading names are still in flux, cite Phase 1 headings and leave a one-line "plan/phase artifacts instantiate these fields" note rather than forking names.

## Verification

- Hard-mode section contains the ordered sequence and the settled-decision rule; default `b-build` path has no new ceremony.
- Completion matrix distinguishes defect / warning / out-of-plan.
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
