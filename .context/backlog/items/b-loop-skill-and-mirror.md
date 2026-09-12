---
title: b-loop skill — advisory + stamp, with deferred slash-command mirror
status: active
priority: medium
created: 2026-07-05
updated: 2026-09-10
completed: null
related:
  - skills/b-loop/SKILL.md
  - prompts/b-kickoff.md
  - skills/b-phase/SKILL.md
  - skills/b-plan/SKILL.md
  - docs/buck-workflow.md#runtime-package-mapping
  - .context/memory/b-loop-skill-creation-2026-07-05.md
  - .context/2026-06-01.deprecate-b-flow/
  - .context/backlog/items/loop-agnostic-execution-loops.md
---

# b-loop skill + slash-command mirror follow-up

## What shipped (2026-07-05)

`skills/b-loop/SKILL.md` exists. It is **advisory + stamp only**:

- Reads an existing phased plan from one of four entrypoints
  (explicit path, explicit subject folder, conversation context,
  Buck-session artifacts in `.context/workflow/current-session.json`
  or `.context/workflow/orchestration.json`).
- Recommends `none | orchestrate | workflow | goal` from plan shape
  using the same rule table as `b-plan/SKILL.md`.
- Stamps `omp_execution` / `omp_goal_budget` onto `phase-N-*.md`
  frontmatter.
- Mirrors the choice into the `## Phase Summary` table in the
  sibling `plan-*-phases.md` (including the literal `none` cell per
  `b-phase`'s template behavior). Single-phase entrypoints mirror
  only the matching row.
- Emits the precondition sentence for the user's first turn of each
  phase.

It does **not** drive the loop — no orchestrator, no state file, no
worker. Pure prompt/skill advisory plus the smallest possible
frontmatter mutation.

## Intentionally deferred

`prompts/b-kickoff.md` exists as a separate OMP `/goal set` objective for
unattended execution. It is not a mirror of the advisory/stamping skill. There
is still no `commands/b-loop.md` or `commands/b-kickoff.md` symlink, so the
skill remains invokable via `/skill:b-loop` (or agent-by-name).

## Acceptance criteria for this revision

- [x] `skills/b-loop/SKILL.md` distinguishes the advisory/stamping skill from
      the separate unattended goal objective in `prompts/b-kickoff.md`.
- [x] SKILL.md writes only `omp_execution` / `omp_goal_budget` on
      phase frontmatter and the matching cell in the phases-overview
      `## Phase Summary` table. No `orchestration.json`. No worker.
- [x] Harness detection uses `omp.runtime` / `pi.runtime` only; no
      `package.json` `omp`-field probing.
- [x] Precondition sentences follow `loop-agnostic-execution-loops`:
      no `ralph_done`, no "Ralph" proper noun.
- [x] All four Markdown tables in the file have valid separator rows
      so the rendered preview isn't broken.

## Follow-ups

### F1. Lift the slash-command mirror

Decide whether to add a conventional advisory-skill slash mirror under a
different command name, or expose the goal objective through an OMP-specific
launcher. `prompts/b-kickoff.md` now names the autonomous goal objective, and a
prompt expansion cannot synthetically toggle OMP goal mode. Then:

- Choose and document the final OMP launcher surface; do not imply a prompt
  expansion can activate `/goal` on the user's behalf.
- Add a row to `docs/buck-workflow.md`'s Quick Reference Table for
  `b-loop`.
- Consider running a smoke `b-loop` invocation through Pi and OMP to
  confirm end-to-end wiring.

### F2. Decide whether `b-plan` should pre-fill `omp_execution`

Today, `b-plan`'s "OMP Execution Recommendation" rule surfaces the
suggested primitive in the plan's prose but does not stamp
`omp_execution` onto every phase file at plan-creation time. Users
who want a recommendation applied to an existing phased plan currently
invoke `/skill:b-loop`. Optional follow-up: have `b-plan` write the
recommendation into a top-level `omp_execution` field on the plan
frontmatter (`plan-*.md` body, not phase files), so `b-phase` can
inherit it when generating discrete phases.

### F3. Optional: `b-save` overview-table reconciliation

If a phased plan was edited by hand (or via a tool outside Buck) and
the overview table got out of sync with the per-phase frontmatter,
`b-save` could detect the drift and normalize. Out of scope for
`b-loop` (which is single-shot advisory). Tracked as a future
maintenance helper.

## Notes

- No formal `b-plan` for this work (single-session skill authoring;
  the in-conversation plan served as the spec).
- No `b-review` invocation — `b-review` is for implementation
  changes, not for canonical-skill content; a manual re-read
  verified the file.
- Branch: `set-goal-buck-workflow-phases`. Not yet committed.
- The skill and this backlog item together replace a hypothetical
  re-introduction of a `b-flow`-style orchestrator (deprecated
  2026-06-01). The advisory+stamp shape honors that deprecation.
