---
title: Make Buck execution loops loop-agnostic (remove Ralph-specific instructions)
status: active
priority: medium
created: 2026-06-24
updated: 2026-06-24
completed: null
related:
  - skills/b-plan/SKILL.md
  - skills/b-phase/SKILL.md
  - skills/b-build/SKILL.md
  - skills/b-iterate/SKILL.md
  - skills/b-review/SKILL.md
  - skills/b-pr-review-2-issues/SKILL.md
  - docs/buck-workflow.md
  - AGENTS.md
---

# Make Buck execution loops loop-agnostic (remove Ralph-specific instructions)

## Problem

The workflow skills hardcode **Ralph-specific** terminology in the generated
mini-cycles and execution instructions. Ralph is one specific autonomous-loop
orchestrator (Pi's); the Buck workflow mini-cycle should describe a **generic
execution loop** that runs identically under Ralph, OMP's `orchestrate` /
`workflow` / `goal` modes, or plain manual execution. Coupling the canonical
skills to `ralph_done` and "Ralph" as a proper noun makes the workflow
non-portable and ties every consumer to one orchestrator.

Ralph-specific coupling found in generated-instruction paths:

- **`skills/b-phase/SKILL.md`** (heaviest) — `## Ralph Execution Checklist`
  (×2), `## Ralph Workflow Instructions`, "Ralph Mini-Cycle Instructions",
  "Ralph-ready", "Ralph loops", "Ralph invocation hint", "Ralph iteration",
  and `ralph_done` throughout the mini-cycle templates.
- **`skills/b-plan/SKILL.md`** — `## Ralph Instructions` section, "Ralph
  automation", "Ralph-ready phases", `ralph_done` in the single-unit cycle.
- **`skills/b-build/SKILL.md`**, **`skills/b-iterate/SKILL.md`**,
  **`skills/b-review/SKILL.md`** — `ralph_done` and "If running inside Ralph"
  conditionals.
- **`skills/b-pr-review-2-issues/SKILL.md`** — `ralph_done` in the mini-cycle.
- **`docs/buck-workflow.md`** — "Ralph loops: run `/b-commit` before
  `ralph_done`".

## Desired outcome

All mini-cycles are written as a **loop-agnostic unit**:

```
build → review → iterate (if issues) → docs (if doc impact) → save → commit → done
```

- The loop-completion signal (`ralph_done`) is expressed generically — e.g.
  "signal loop completion per your active orchestrator" — or the
  orchestrator-specific call is moved behind a harness note, never inline in
  the canonical sequence.
- "Ralph" as a proper noun is removed from generic instructions; renamed to
  "execution loop" / "active loop" / "loop unit".
- Generated templates rename: `## Ralph Execution Checklist` →
  `## Execution Loop Checklist`; `## Ralph Instructions` / `## Ralph Workflow
  Instructions` → `## Execution Loop Instructions`. The `omp_execution`
  field still carries the OMP-specific opt-in (that is a separate, intentional
  harness coupling and stays).
- "If running inside Ralph" becomes loop-agnostic ("If running inside an
  autonomous loop…") with Ralph named only as one example.

## Acceptance criteria

- [ ] No bare `ralph_done` literal in any skill's mini-cycle / generated
      instruction template (it lives behind a harness note or generic phrasing).
- [ ] "Ralph" as a proper noun removed from generic mini-cycle prose across
      `b-plan`, `b-phase`, `b-build`, `b-iterate`, `b-review`,
      `b-pr-review-2-issues`.
- [ ] Checklist/section headers in `b-phase` and `b-plan` renamed to
      loop-agnostic equivalents.
- [ ] The mini-cycle still reads: build → review → iterate (if issues) → docs
      (if doc impact) → save → commit → done.
- [ ] `docs/buck-workflow.md` aligned (the OMP-autonomous-loops section keeps
      its `omp_execution` opt-in — that is intentional harness integration,
      not Ralph coupling).
- [ ] Scoped search confirms no stray `ralph_done` / "Ralph" remains in
      generated-instruction paths (`.context/` history and archival brainstorms
      are out of scope — do not rewrite history).
- [ ] README/AGENTS unaffected unless they reference Ralph (check and align if
      so).

## Notes

- Out of scope: the `omp_execution` field and OMP autonomous-loop primitives
  (`orchestrate`/`workflow`/`goal`). Those are a deliberate, documented
  harness integration (see `docs/buck-workflow.md` § OMP Autonomous Loops),
  not Ralph coupling.
- Out of scope: `.context/` historical artifacts and `docs/brainstorms/` —
  these are immutable history.
