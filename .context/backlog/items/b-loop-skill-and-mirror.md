---
title: b-loop skill — advisory + stamp, with deferred slash-command mirror
status: active
priority: medium
created: 2026-07-05
updated: 2026-07-05
completed: null
related:
  - skills/b-loop/SKILL.md
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

**No `prompts/b-loop.md` and no `commands/b-loop.md` symlink in this
revision.** Per the user's "skill only, no slash command mirror"
selection, `/b-loop` does not appear in Pi's `/`-menu nor OMP's
`/`-menu. The skill is invokable via `/skill:b-loop` (or
agent-by-name), but not via `/b-loop` slash discovery.

## Acceptance criteria for this revision

- [x] `skills/b-loop/SKILL.md` exists and self-documents the
      no-mirror surface choice in `## Surface — No Slash Command
      Mirror (Deferral)`.
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

Mechanical: add `prompts/b-loop.md` (description copy + `$ARGUMENTS`
+ skill-load line) and a `commands/b-loop.md` symlink. Verify Pi
discovers the new prompt and OMP discovers the new command. Then:

- Update SKILL.md `## Surface — No Slash Command Mirror` to
  `## Surface — Slash Command Mirror` and flip the practical
  consequence from "doesn't appear" to "appears".
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
