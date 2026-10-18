---
status: completed
date: 2026-05-02
subject: 2026-05-02.b-phase-model-hints
topics: [b-phase, model-hints, phase-difficulty, buck-workflow]
research: []
spec:
memory: [b-phase-model-hints-2026-05-02.md]
---

# Plan: Add model hints to b-phase output

## Goal
Make `b-phase` annotate each generated phase with a simple difficulty/model hint so later execution can choose an appropriate model shape.

## Scope
- Update `skills/b-phase/SKILL.md`
- Update `docs/buck-workflow.md`
- Keep the rubric simple: `easy`, `medium`, `hard`

## Out of scope
- Runtime enforcement of model choice
- Adding new Buck commands
- Hard-coding provider/model IDs

## Affected files
- `skills/b-phase/SKILL.md` — add rubric + output requirements
- `docs/buck-workflow.md` — document the new phase model hints

## Implementation steps
1. Add an `easy | medium | hard` rubric to `b-phase`.
2. Require each phase to include a difficulty label and model hint.
3. Map hints to existing workflow commands where useful (`/b-build` vs `/b-build-hard`).
4. Update docs to match the skill behavior.

## Verification
- [x] `skills/b-phase/SKILL.md` clearly instructs the agent to classify each phase.
- [x] Output template for `plan-*-phases.md` includes difficulty/model hint fields.
- [x] `docs/buck-workflow.md` describes the new behavior consistently.

## Risks
- Over-specifying concrete model IDs would age badly.
- Introducing more than three buckets would add noise without much value.
