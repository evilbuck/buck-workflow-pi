---
status: active
date: 2026-05-17
subject: 2026-05-17.b-review-plan-path
topics: [b-review, plan-path, acceptance-contract, workflow, skills]
research: [research-b-review-plan-path.md]
spec: null
memory: []
---

# Plan: Let b-review verify completed work from an explicit plan path

## Goal

Update Buck workflow review instructions so `/b-review <plan-or-subject-path>` treats the referenced plan/spec/phase as the acceptance contract, discovers implementation evidence itself, and reports whether the planned work appears complete. The user should not have to provide a diff.

## Context used / assumptions

- User-provided context: the requested plan is based on `.context/2026-05-17.b-review-plan-path/research-b-review-plan-path.md`.
- Session context: Buck workflow canonical logic lives in `skills/`; prompt templates in `prompts/` are thin wrappers.
- Artifacts used: `research-b-review-plan-path.md`.
- Code/docs inspected: `skills/b-plan/SKILL.md`, `skills/b-review/SKILL.md`, `prompts/b-review.md`, `skills/b-build/SKILL.md`, `README.md`, `.context/workflow/current-session.json`, and recent memory index/state.
- Assumption: this is primarily a skill-instruction change. No TypeScript extension work is needed because `prompts/b-review.md` already passes `$ARGUMENTS` through to the loaded skill.
- Open question: whether to update only the prompt description or also add a short argument note in the prompt body. This plan includes the small prompt documentation update because it improves discoverability without changing behavior.

## Scope

- Revise `skills/b-review/SKILL.md` so explicit plan/spec/phase paths have first priority in scope resolution.
- Clarify that b-review does not critique a plan as a planning artifact unless asked; it uses the plan as the implementation acceptance contract.
- Add a work-discovery protocol that uses current git state, staged changes, recent commits, subject artifacts, workflow state hints, and source-state inspection rather than requiring a user-provided diff.
- Add specific completion-review behavior for `plan-*.md`, `plan-*-phases.md`, `phase-*.md`, and `spec-*.md` inputs.
- Add an output contract for plan-path reviews: evidence sources, completion matrix, verification status, out-of-scope findings, verdict, and next step.
- Update `prompts/b-review.md` description/body to mention optional plan/spec/subject path arguments.

## Out of scope

- Implementing a persistent plan-specific implementation ledger. That is already tracked separately in `.context/backlog/items/plan-implementation-ledger.md`.
- Changing `/b-save`, b-build phase-state behavior, or session tracking extension code.
- Adding runtime automation to resolve or parse plan paths before the model sees them.
- Reworking all Buck workflow skills for argument parsing consistency.
- Running expensive full-suite validation unless the implementation change unexpectedly touches executable code.

## Affected files

- `skills/b-review/SKILL.md` — primary canonical behavior update.
- `prompts/b-review.md` — optional discoverability/documentation tweak; keep as a thin wrapper.
- `.context/2026-05-17.b-review-plan-path/research-b-review-plan-path.md` — cross-reference `informs:` back to this plan.

## Implementation steps

1. Edit `skills/b-review/SKILL.md` introduction to replace the current “You do not review plans” wording with plan-as-acceptance-contract language.
2. Add an “Invocation inputs” section describing accepted optional arguments: explicit plan path, spec path, phase path, subject folder path, or freeform review target.
3. Update scope resolution order so explicit user-provided path(s) come before active subject folder scanning; if a subject folder is provided, load its best matching active plan/spec/phase artifact.
4. Add a “Work discovery protocol” section that explicitly says a user-provided diff is not required and lists evidence sources: `git status`, `git diff`, `git diff --cached`, relevant commits since plan date/baseline, subject-folder artifacts, workflow state hints, plan affected files, and direct source inspection.
5. Add a “Plan completion review protocol” section that instructs b-review to parse goal/scope/out-of-scope/affected files/implementation steps/verification/risks and produce complete/partial/missing/not-verifiable statuses for each planned step.
6. Add phased-plan handling: `plan-*-phases.md` defaults to current active phase unless user asks for all phases; `phase-*.md` reviews only that phase; completed status/checkboxes are evidence but not proof.
7. Revise output templates to include a plan-path review report with plan source, evidence sources, completion matrix, verification status, out-of-scope changes, verdict, and recommended next step; preserve the existing iterate-artifact behavior when issues are found.
8. Update `prompts/b-review.md` description/body to document that arguments may include a plan/spec/phase/subject path, while still loading `skills/b-review/SKILL.md` unchanged.

## Verification

- Read the updated `skills/b-review/SKILL.md` end-to-end and confirm it remains read-only for reviews except iteration artifacts on real findings.
- Confirm `prompts/b-review.md` still passes `$ARGUMENTS` before loading `skills/b-review/SKILL.md` and remains a thin wrapper.
- Run a text search for conflicting old wording such as “You do not review plans” and resolve it if still misleading.
- If practical, perform a dry-run mental simulation against this plan path: `/b-review .context/2026-05-17.b-review-plan-path/plan-b-review-plan-path.md` should know how to discover work and report completion without a supplied diff.
- No TypeScript build is required if only Markdown skill/prompt files change.

## Risks

- Overly long skill instructions could make b-review harder to follow; keep the new sections structured and avoid duplicating the research artifact verbatim.
- Commit-baseline inference can be noisy on long-lived branches; instruct the skill to state the baseline/evidence used and fall back to source-state verification.
- Multiple workflow sessions may touch the same files; the review should avoid treating unrelated branch-wide diff as proof or failure for the provided plan.
- If prompt wording becomes too specific, users may think plan paths are required. Keep it explicitly optional.

## Recommended next step

Run `/b-build` for this straightforward documentation/skill behavior update, then `/b-review .context/2026-05-17.b-review-plan-path/plan-b-review-plan-path.md` to validate that the revised instructions support plan-path review semantics.
