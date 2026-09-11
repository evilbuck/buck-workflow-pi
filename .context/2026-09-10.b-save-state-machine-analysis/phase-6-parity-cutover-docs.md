---
status: completed
phase: 6
order: 6
plan: plan-b-save-state-machine.md
phases_overview: plan-b-save-state-machine-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Demonstrate parity, perform the atomic cutover to exactly /b-save and /deprecated-b-save, and migrate live documentation."
files:
  - skills/deprecated-b-save/SKILL.md
  - prompts/deprecated-b-save.md
  - commands/deprecated-b-save.md
  - skills/b-save/SKILL.md
  - prompts/b-save.md
  - commands/b-save.md
  - extensions/index.ts
  - skills/b-save-improved
  - extensions/b-save-improved
  - prompts/b-save-improved.md
  - commands/b-save-improved.md
  - AGENTS.md
  - GLOBAL_OR_PROJECT-AGENTS.md
  - README.md
  - docs/buck-workflow.md
  - docs/extension-loading.md
  - docs/oh-my-pi.md
  - package.json
from_plan_steps: [10, 11]
depends_on: [5]
dependency_type: HARD
acceptance_criteria:
  - "[x] Parity checklist passes: all twelve responsibilities, stale-input invalidation, model retry/exhaustion, prompt-injection content, user gates, interrupted-apply recovery, rerun idempotency, and supported/unsupported memory backends — compared against the current prompt contract and `/b-save-improved` strengths."
  - "[x] Live OMP session verification: clean session with the package linked, `/b-save` invoked against a disposable project, one run interrupted and resumed, resulting `.context` files and effect report inspected."
  - "[x] Cutover performed atomically after parity: old prompt implementation preserved as `/deprecated-b-save` (skill + prompt + command), engine registered as `/b-save` in `extensions/index.ts`, `/b-save-improved` (skill, extension, prompt, command) removed."
  - "[x] Command discovery in fresh sessions resolves exactly the two requested names: `/b-save` and `/deprecated-b-save`; `/b-save-improved` does not resolve."
  - "[x] `/deprecated-b-save` loads in a clean harness session and preserves the legacy prompt contract."
  - "[x] Live catalogs and docs (AGENTS.md, GLOBAL_OR_PROJECT-AGENTS.md, README.md, docs/buck-workflow.md, docs/extension-loading.md, docs/oh-my-pi.md) describe the engine/fallback split; historical `.context/**` records are untouched."
  - "[x] Repository reference sweep finds no live `b-save-improved` or prompt-only `/b-save` claims outside intentional historical records; README tail re-read after every table edit (2026-09-04 truncation rule)."
  - "[x] `/b-guardrails-check` durable contract passes; a failing gate blocks completion."
completed_at: 2026-09-10
completed_by: omp-goal
---

# Phase 6: Parity, Atomic Cutover & Documentation

## Context

Parent plan user goal (inherited): Buck Workflow users run the new deterministic checkpoint as `/b-save`, while the current prompt-driven workflow remains available as `/deprecated-b-save` for compatibility and fallback.

The blast-radius phase. Nothing is renamed or removed until the parity checklist passes; then the cutover is atomic and documentation follows. Covers plan steps 10–11.

## Implementation Details

1. **Parity demonstration (plan step 10).**
   - Fixture + live-OMP scenarios covering: all twelve responsibilities, stale-input invalidation, model retry/exhaustion, prompt-injection content, user gates, interrupted apply recovery, rerun idempotency, supported/unsupported memory backends.
   - Compare observable `.context` outputs against the current prompt contract and `/b-save-improved` strengths. Record the comparison as evidence in this subject folder.
   - Live check: clean OMP session with the package linked; invoke `/b-save` on a disposable project; interrupt and resume one run; inspect `.context` files and effect report.
2. **Atomic cutover (plan step 10, only after the checklist passes).**
   - Preserve the current prompt implementation under `/deprecated-b-save`: `skills/deprecated-b-save/SKILL.md`, `prompts/deprecated-b-save.md`, `commands/deprecated-b-save.md` — content is the current prompt-driven workflow, renamed.
   - Rewrite `skills/b-save/SKILL.md`, `prompts/b-save.md`, `commands/b-save.md` to describe and invoke the deterministic state-machine contract.
   - Register the engine in `extensions/index.ts`; remove `/b-save-improved` wiring and delete `skills/b-save-improved/**`, `extensions/b-save-improved/**`, `prompts/b-save-improved.md`, `commands/b-save-improved.md`.
   - Verify loader-native discovery in fresh sessions: exactly `/b-save` and `/deprecated-b-save` resolve.
3. **Documentation & packaging migration (plan step 11).**
   - Update completion flow, runtime ownership, compatibility, fallback name, and installation/loading truth table in `AGENTS.md`, `GLOBAL_OR_PROJECT-AGENTS.md`, `README.md`, `docs/buck-workflow.md`, `docs/extension-loading.md`, `docs/oh-my-pi.md`.
   - Normalize `package.json` (files list, SDK dependency) from Phase 1's provisional wiring.
   - Reference sweep for live `b-save-improved` and prompt-only `/b-save` claims; update every current caller; leave historical `.context/**` intact.
   - **README tail rule** (2026-09-04 lesson): after any table insert in `README.md`, re-read the file tail to verify nothing was clobbered.

## Risks

- **Cutover shadowing or duplicating prompt/extension surfaces** — perform it only after parity, in one commit-sized batch, and verify loader-native discovery in fresh sessions.
- **README truncation during catalog edits** — the 2026-09-04 `b-recap` incident deleted everything after the commands table; re-read the tail after every table edit.
- **Rewriting history by accident** — historical `.context/**` records mentioning `b-save-improved` are intentional exceptions; the sweep touches only live surfaces.

## Verification

- Parity checklist recorded with evidence; live session interrupt/resume verified.
- Fresh-session command discovery: exactly `/b-save` and `/deprecated-b-save` resolve; `/deprecated-b-save` loads the legacy contract.
- Reference sweep results classified (live vs intentional historical).
- `/b-guardrails-check` passes — failing gate blocks this phase and the goal.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.

*(Goal mode: this phase runs under the goal set in Phase 1's first turn. The live-session parity checks are the one place the goal session may need to hand control to the user — do not call `goal({op:'complete'})` until the parity checklist and guardrails pass.)*
