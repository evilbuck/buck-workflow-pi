---
date: 2026-07-05
domains: [skill, buck-workflow, omp]
topics: [b-loop, omp-execution, phased-plan, set-goal, advisory-stamp, slash-command-deferral, loop-agnostic, b-flow-deprecation, b-phase, scope-reduction]
subject: 2026-07-05.b-loop-skill-creation
artifacts:
  - skills/b-loop/SKILL.md
related:
  - skills/b-phase/SKILL.md
  - skills/b-plan/SKILL.md
  - docs/buck-workflow.md
  - docs/b-flow.md
  - .context/2026-06-01.deprecate-b-flow/
  - .context/backlog/items/loop-agnostic-execution-loops.md
  - .context/memory/b-docs-living-documentation-2026-06-24.md
  - .context/memory/loop-agnostic-decision-2026-06-24.md
priority: medium
status: active
---

# b-loop skill — Advisory + Stamp for Phased-Plan Execution Loops

## What

Added `skills/b-loop/SKILL.md`. Reads an existing phased plan, recommends
one of `none | orchestrate | workflow | goal` from plan shape, and stamps
`omp_execution` / `omp_goal_budget` onto the affected `phase-N-*.md`
frontmatter plus the matching `omp_execution` cell in the
`plan-*-phases.md` `## Phase Summary` table. Emits the precondition
sentence to drop on the first turn of each phase.

## Path-to-yes (most instructive)

1. **User asked** for "a new skill for the buck-workflow" that "allows an
   agent to set a loop or goal on a phased plan" with each phase
   travelling through `b-build/b-build-hard → b-review → b-iterate →
   b-review|b-save → b-commit`.

2. **Pre-build scope check** found the function already exists in two
   pieces:
   - `omp_execution` field on every phase frontmatter
     (`skills/b-phase/SKILL.md:165`), with `b-phase` already writing
     per-phase precondition sentences at `:227-234`.
   - Plan-level recommendation rule in `b-plan/SKILL.md:212-235`
     (recommend one primitive from plan shape).
   - `b-flow` extension was the previous answer but was deprecated
     2026-06-01 (`.context/2026-06-01.deprecate-b-flow/`).
   - Active backlog item `loop-agnostic-execution-loops.md` already
     declares the loop-agnostic mini-cycle invariant.

   Pushed back on building a new orchestrator; aligned on a
   **prompt-level advisory + stamp** with the same SKILL.md body as
   canonical.

3. **User picked scope:** "Advisory + stamp only" (no state machine, no
   orchestrator).

4. **User picked surface:** Skill only — no slash command mirror
   (overrode an earlier "Skill + prompts/ + commands/ mirror" selection
   mid-conversation). Documented the deferral explicitly in
   `## Surface — No Slash Command Mirror (Deferral)` so future readers
   don't mistake it for an oversight.

5. **Advisors caught real defects** during drafting:
   - **Description-line `/skill:b-loop` invariant**: only `/skill:` form
     works without a mirror; corrected body / closeout re-run hint
     accordingly.
   - **`OMG / OMP` typo**: had `**OMG / OMP autonomous-loop primitives**`
     in the Harness Note header — fixed.
   - **`omp_execution: none` is not a meaningful value**: rewrote
     harness-note bullet to "omits `omp_execution` entirely (default is
     omitted)".
   - **`package.json`'s `omp` field is package metadata, not runtime
     state**: package always declares `omp` regardless of which harness
     loads it, so probing it would falsely conclude OMP. Switched
     harness detection to `omp.runtime` / `pi.runtime` only.
   - **Overview table mirror**: `b-loop`'s stamp step only edited
     `phase-N-*.md`, leaving `plan-*-phases.md`'s `## Phase Summary`
     stale. Added Step 3b "Phases-overview table (mirror)" so the
     overview and discrete phases stay in lock-step.
   - **Overview-table cell literal**: `b-phase` writes the **literal
     string `none`** in the `omp_execution` column even when the
     per-phase frontmatter key is omitted (template at
     `skills/b-phase/SKILL.md:271-275`). Step 3b clause 2 now
     explicitly says "do **not** leave the cell empty"; the cell must
     carry the literal `none` so the rendered table never looks stale.

## Design decisions

- **Skill only, no slash mirror (per user).** Invocation: `/skill:b-loop`,
  `load_skill name=b-loop`, or agent-by-name. Not advertised via `/b-loop`
  because no `prompts/b-loop.md` exists. Deferral recorded in-memory and
  in-backlog for a follow-up that adds the paired prompt + symlink.

- **Advisory + stamp only.** No state machine, no `orchestration.json`,
  no worker subagent. Mirrors the 2026-06-01 b-flow deprecation lesson:
  extension-based orchestration that is not observably invoked becomes
  dead weight.

- **Reuses the existing `omp_execution` field on phase frontmatter**
  (defined in `b-phase`) and the existing plan-level recommendation
  table (defined in `b-plan`). Skill is purely a *re-application* of
  what's already specified — fills the gap that previously motivated
  `b-flow`.

- **Step 3 splinters into 3a (phase files) + 3b (overview table)**
  with explicit "skip cleanly" clauses 4 and 5 for backward-compat
  shims (no `omp_execution` column, no `plan-*-phases.md`).

- **`omp_goal_budget` rubric reused from `b-phase`**: 4k per easy,
  8k per medium, 16k per hard, plan-summed, rounded to nearest 5k.
  Non-phased default 12k. Documented so the user can override.

- **Boundaries call out the overview-table exception.** The
  "No plan-level mutation" boundary now reads as "no plan *frontmatter*
  mutation; the one allowed mutation outside `phase-N-*.md` is the
  overview-table cell".

- **Loop-agnostic language.** Per `loop-agnostic-execution-loops.md`:
  precondition sentences in Step 4 use `## Ralph Mini-Cycle Instructions`
  replacement, no `ralph_done`, no "Ralph" proper noun. Ralph named only
  as one example orchestrator when relevant.

## Files

Created:
- `skills/b-loop/SKILL.md` — only artifact in this revision.

No other files touched:
- No `prompts/b-loop.md` (per the user's no-mirror selection).
- No `commands/b-loop.md` (same reason).
- No `package.json` change needed — Pi and OMP both walk the
  `skills/` directory wholesale (`package.json:20-30`,
  `scripts/install.mjs:34-65`); adding `SKILL.md` is enough.
- No `docs/buck-workflow.md` change yet — Quick-Reference Table entry
  would be added when the slash mirror is lifted (follow-up).

## Verification

- File reads end-to-end as a single coherent document; no stale-edit
  artifacts (dangling fragments from earlier anchored edits were
  cleaned during the post-rewrite re-read pass).
- All four advisor-flagged defects (`/b-loop` vs `/skill:b-loop`
  invariant, OMG/OMP typo, default-is-omission, package.json
  omp-field-constant) are fixed.
- Overview-table mirror clause (Step 3b) covers three cases:
  normal stamp, missing-column skip, missing-overview skip.
- Pre-condition sentences follow `b-phase`'s shape exactly with the
  `loop-agnostic-execution-loops` rewording.
- Idempotency statement covers both the per-phase frontmatter and the
  overview table cells.

## Open follow-ups

- **F1.** Lift the slash-command-mirror deferral by adding
  `prompts/b-loop.md` + `commands/b-loop.md` symlink. Mechanical: copy
  the description, add the two files. No skill-body change required.
  Consider also wiring `/b-loop` into the cross-platform installer
  `buck-workflow install` registry (no test currently asserts on it).
- **F2.** Add a row to the `docs/buck-workflow.md` Quick Reference
  Table listing `b-loop` together with `b-phase` / `b-plan`. Deferrable
  to the same PR as F1.
- **F3.** Optional: extend `b-plan`'s recommendation rule with a
  stamp-back-from-plan step so freshly authored plans pre-fill
  `omp_execution` from the recommendation table. Currently `b-loop`
  is the only surface that applies the recommendation to an *existing*
  plan; `b-plan` only writes it at plan-creation time. Tracked as a
  backlog item if/when the user wants it.

## Notes

- No formal `b-plan` for this work — it was a single-session skill
  authoring task, the prior plan-shaped discussion (this conversation)
  served as the spec.
- No spec, no iterate artifact, no b-review gate (this is a single,
  bounded, additive skill file; the `b-review` step is meant for
  implementation changes, not the canonical-skill content itself).
- Branch: `set-goal-buck-workflow-phases`. Not yet committed.
- Quality gate per global AGENTS.md: memory written (this file),
  memory index updated (next step), backlog updated (next step).
