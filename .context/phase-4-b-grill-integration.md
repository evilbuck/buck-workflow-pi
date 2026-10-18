---
status: pending
phase: 4
order: 4
plan: plan-cross-harness-kernel.md
phases_overview: plan-cross-harness-kernel-phases.md
difficulty: hard
model_hint: strongest reasoning model available; ambiguity in decision_domains shape, cross-cutting skill edits
buck_hint: /b-build-hard
ralph_complexity: multi
goal: "F9 from follow-ups: b-grill-me and b-grill-with-docs auto-derive the eval cell's PHASES list and build_prompt() body from decision_domains. New skill section, not new skill."
omp_execution: none
files:
  - skills/b-grill-me/SKILL.md
  - skills/b-grill-with-docs/SKILL.md
  - docs/eval-kernel.md
  - .context/2026-06-06.omp-integration-buck-workflow/index.md
from_plan_steps: [1, 2, 3, 4]
depends_on: [2, 3]
dependency_type: HARD
acceptance_criteria:
  - "[ ] b-grill-me has a new \"Feeding the workflow-kernel cell\" section"
  - "[ ] b-grill-with-docs has the same section (the two skills are siblings)"
  - "[ ] Mapping table covers all decision_domain shapes the existing skills emit"
  - "[ ] Auto-derive algorithm is specified: enumerate decision_domains, emit (N, slug, difficulty, brief) tuples"
  - "[ ] docs/eval-kernel.md has a \"decision_domains → PHASES\" subsection"
  - "[ ] Subject folder index.md is set to status: completed"
  - "[ ] npx vitest run still 163/163 passing"
completed_at: null
completed_by: null
---

# Phase 4: b-grill* integration with the cell

## User Goal

Inherited from the parent plan. *Skip duplication* — see `## Context`
below for the restated goal.

## Context

**Parent plan user goal** (inherited): "Maintainer of `buck-workflow-pi`
(and downstream packages following the same pattern) who installs on
**any** of the five supported harnesses (Pi, OMP, Claude Code, OpenCode,
Codex). The work makes the omp-integration surfaces safely no-op on
non-OMP harnesses instead of producing misleading slash commands, and it
elevates the eval-kernel work from a one-shot starter template into a
phased workstream with concrete deliverables."

This phase hard-depends on Phases 2 and 3:
- The `decision_domains → PHASES` mapping is defined in `docs/eval-kernel.md`
  (Phase 2).
- The cell shape (the `parallel()` + `llm()` + schema pattern) is exercised
  in the two example cells (Phase 3).

The goal is F9 from `follow-ups.md` — close the loop between
`b-grill-me` / `b-grill-with-docs` and the eval cell. Right now,
`b-grill*` writes a `grill-session-*.md` with `decision_domains`, and
`b-plan` writes a starter `eval-<topic>.py` with placeholder
`PHASES`. The user fills the placeholders by hand. Phase 4 makes
`b-grill*` pre-populate the cell from the interview's `decision_domains`
when the plan declares `omp_execution: workflow` AND the upstream
`b-grill*` session produced at least one `decision_domain`.

This is **a new skill section, not a new skill.** The b-flow deprecation
(2026-06-01) is the lesson: extension-based orchestration is dead
weight. New behavior goes into existing skills, not into new ones.

## Implementation Details

From the parent plan, `Phase 4: b-grill* integration with the cell`:

1. **Read `skills/b-grill-me/SKILL.md` and `skills/b-grill-with-docs/SKILL.md`**
   to confirm the `decision_domains` data shape (the output of a grilling
   session).

2. **Append a "Feeding the workflow-kernel cell" section to both skills**
   with:
   - A mapping table: `decision_domain` → `PHASES` entry (one `agent()`
     per domain, brief = domain rationale).
   - An auto-derive algorithm: enumerate `decision_domains`, for each
     emit `(N, slug_of(domain), difficulty=medium, brief=domain.rationale)`,
     write to `.context/<subject>/eval-<topic>.py` using the F6 template
     as the body.
   - A note: this only fires when the plan declares
     `omp_execution: workflow` AND the upstream `b-grill*` session
     produced at least one `decision_domain`. Otherwise the user fills
     the cell by hand.

3. **Append a "decision_domains → PHASES" subsection to `docs/eval-kernel.md`**
   — describe the mapping's invariants (one `agent()` per domain,
   schema is unchanged, judge prompt names the domains explicitly).

4. **Update `.context/2026-06-06.omp-integration-buck-workflow/index.md`**
   — set `status: completed`.

### decision_domains shape (read from b-grill-me)

The `decision_domains` field in the grill session file's frontmatter
is a list of:

```yaml
- name: <Domain Name>          # e.g. "Data Model"
  questions: [<Q-numbers>]     # e.g. [1, 2, 3, 4, 5, 6, 7]
  resolved: <count>            # e.g. 5
  deferred: <count>            # e.g. 0
```

Some sessions may also have `rationale:` (free-form text the user gave
to justify the domain) and `break_points:` at the top level. The
`break_points` are the question numbers where the model identified a
natural phase boundary.

### Mapping table (the b-grill* skill section)

The new section in both `b-grill-me` and `b-grill-with-docs` looks like:

```markdown
## Feeding the workflow-kernel cell

After a grilling session produces a `grill-session-*.md`, the
`decision_domains` list can feed the eval cell's `PHASES` list when
the plan declares `omp_execution: workflow` AND the plan's `b-plan`
wrote a starter `eval-<topic>.py`. **Both conditions must hold**;
otherwise the user fills the cell by hand.

### Mapping table

| `decision_domains[*].name` | `PHASES` entry |
|---|---|
| Domain name (any string) | `(N, slug, "medium", domain.rationale or "see grill-session")` |

The mapping is **one row per domain**. The auto-derive algorithm
enumerates `decision_domains` in order and emits one `agent()` per
domain. The domain's `name` becomes the `slug` (kebab-cased); the
domain's `rationale` (if present) becomes the `brief`; difficulty
defaults to `medium` unless the model has a signal otherwise.

### Auto-derive algorithm

1. Read the active plan's `omp_execution` field. If not `workflow`,
   skip this section.
2. Read `.context/<subject>/grill-session-*.md` (most recent). If absent
   or `decision_domains` is empty, skip.
3. For each `decision_domain` in order:
   - `N` = 1-indexed position in the list.
   - `slug` = `domain.name.lower().replace(" ", "-")`. If two domains
     slug to the same value, append `-2`, `-3`, etc.
   - `difficulty` = `"medium"`. (The grilling session does not emit a
     difficulty signal; the user can edit by hand.)
   - `brief` = `domain.rationale or f"see grill-session-{topic}.md (domain {N})"`.
4. Emit `.context/<subject>/eval-<topic>.py` using the F6 template as
   the body and the derived `PHASES` list.
5. Tell the user: "I derived the cell's `PHASES` from your grill session's
   `decision_domains`. Edit by hand if the auto-derived values are off."

### Why this is opt-in

`b-grill*` does not auto-write the cell. The user must invoke
`b-plan` first, see the `omp_execution: workflow` recommendation, then
return to the grilling session output. The auto-derive only runs in
the **next** `b-plan` invocation (the one that produces a plan with
`omp_execution: workflow`). This keeps the grilling session pure
(decision capture) and the planning session pure (artifact emission).
```

### docs/eval-kernel.md subsection

Append to `docs/eval-kernel.md` (created in Phase 2) a new
"decision_domains → PHASES" subsection under "Schemas":

```markdown
### decision_domains → PHASES

When a `b-grill*` session has produced `decision_domains` AND a
`b-plan` invocation has recommended `omp_execution: workflow`, the
auto-derive mapping (see `skills/b-grill-me/SKILL.md` § "Feeding the
workflow-kernel cell") emits one `PHASES` entry per domain. The
invariants are:

- **One `agent()` per domain.** The cell's `parallel()` list length
  equals the number of `decision_domains` (NOT the number of plan
  phases — the two are independent).
- **Schema is unchanged.** The auto-derived cell uses the same
  `FINDINGS_SCHEMA` (per-phase `{verdict, evidence, risks,
  open_questions}`). The mapping does not introduce a new schema.
- **Judge prompt names the domains.** The synthesis `llm()` prompt
  includes the domain names explicitly so the judge can adjudicate
  per-domain rather than per-phase.

If the `b-grill*` session produced no `decision_domains` (a small
"pre-flight" interview, or a session that concluded `cohesive`),
the cell falls back to the user-fills-by-hand flow from Phase 3.
```

### Step-by-step

1. **Read `skills/b-grill-me/SKILL.md` end-to-end** and
   `skills/b-grill-with-docs/SKILL.md` end-to-end. Confirm the
   `decision_domains` data shape and the section structure. Do not
   re-read the whole file if you have it in context.
2. **Edit `skills/b-grill-me/SKILL.md`** — append the "Feeding the
   workflow-kernel cell" section before the "Notes" / final section.
3. **Edit `skills/b-grill-with-docs/SKILL.md`** — same section
   (the two skills are siblings — `b-grill-with-docs` is `b-grill-me`
   plus doc awareness). Place it before the "Notes" / final section.
4. **Edit `docs/eval-kernel.md`** — append the "decision_domains →
   PHASES" subsection to the "Schemas" section.
5. **Edit `.context/2026-06-06.omp-integration-buck-workflow/index.md`** —
   set `status: completed` (the subject folder is now finished).

### Verification steps (run yourself before yielding)

```bash
# 1. Tests still pass — Phase 4 changes doc/skill text, not code, but
#    a Markdown typo could still break the linter.
npx vitest run

# 2. New section is present in both b-grill* skills.
grep -F "## Feeding the workflow-kernel cell" skills/b-grill-me/SKILL.md
grep -F "## Feeding the workflow-kernel cell" skills/b-grill-with-docs/SKILL.md

# 3. docs/eval-kernel.md has the new subsection.
grep -F "decision_domains → PHASES" docs/eval-kernel.md

# 4. Subject folder index.md is status: completed.
head -3 .context/2026-06-06.omp-integration-buck-workflow/index.md

# 5. Mapping table covers the decision_domain shape.
#    Verify the table has the right number of rows and the column
#    headers are correct.
grep -A2 "## Mapping table" skills/b-grill-me/SKILL.md | head -5
```

## Risks

- **Phase 4 depends on `decision_domains` shape stability.** If the
  shape changes (e.g., a future `b-grill-me` adds `complexity:` per
  domain), the mapping is wrong. Mitigation: Phase 4 step 1 reads the
  existing skills to confirm the shape before adding the new section.
  If unstable, F9 splits into a spec + plan (out-of-scope note in the
  parent plan).

- **Auto-derive could be too aggressive** — firing when the user only
  wants to capture decisions, not generate a cell. Mitigation: the
  opt-in is gated on **both** `omp_execution: workflow` AND a non-empty
  `decision_domains`. A casual `b-grill-me` interview that produces
  zero domains does not trigger the auto-derive.

- **Slug collisions** — two domains that kebab-case to the same value
  would produce duplicate `PHASES` entries. Mitigation: append `-2`,
  `-3`, etc. to subsequent collisions, matching the F6 template's
  expectation that slugs are unique within `PHASES`.

- **The judge prompt's per-domain phrasing** could read as "per phase"
  to the LLM if the prompt is not explicit. Mitigation: the docs and
  the section both say "name the domains explicitly" — the auto-derive
  emits a `build_prompt()` that includes `domain.name` literally.

- **The b-flow deprecation lesson** — Phase 4 is a new skill **section**,
  not a new skill or extension. The risk is that someone later re-runs
  this work and adds a new skill. Mitigation: the parent plan's
  "Out of scope" list explicitly excludes a new `b-phase-kernel`
  skill. The new section's title is "Feeding the workflow-kernel cell",
  not "b-phase-kernel" — the title keeps the relationship clear.

## Verification

- `b-grill-me` and `b-grill-with-docs` each have a "Feeding the
  workflow-kernel cell" section.
- The mapping table covers all `decision_domain` shapes the existing
  skills emit.
- `docs/eval-kernel.md` has a "decision_domains → PHASES" subsection
  under "Schemas".
- Subject folder `index.md` is `status: completed`.
- `npx vitest run` — 163/163 still pass.

## Ralph Mini-Cycle Instructions

If executing this phase inside a Ralph loop:

1. Run the indicated Buck build command (`buck_hint: /b-build-hard`)
   for this phase only. Use `/b-build-hard` because Phase 4 is the
   hard phase (cross-skill edits, ambiguity in the data shape, several
   risks). `/b-build` may not exercise the right review depth.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then
   re-run `/b-review`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/git-commit` to checkpoint durable state before `ralph_done`.
6. If the phase is incomplete, leave `status: in-progress` so the next
   Ralph iteration resumes here.
7. **This is the final phase.** When complete, also:
   - Update the parent plan's `iterations:` field in its frontmatter
     with the iteration history.
   - Update the subject folder's `index.md` to `status: completed`.

If the phase's frontmatter declares `omp_execution: orchestrate | workflow | goal`,
expand step 1 above with a one-liner **before** the build command runs:

| `omp_execution` | First-turn precondition |
|---|---|
| `orchestrate` | "Type the `orchestrate` keyword anywhere in your first turn of this phase. omp will inject the orchestrator contract (parallel `task` subagents, no-yield between phases, verify-after-every-phase)." |
| `workflow` | "Open `.context/<subject>/eval-<topic>.py`, run the cell, then type the `workflow` keyword in your first turn. The eval kernel fans out one `agent()` per phase." |
| `goal` | "Run `/goal set <plan User Goal> --budget <omp_goal_budget>`, then begin the build. The active goal persists across turns and triggers the 6-step completion-audit on `goal({op:'complete'}).`" |

For this phase, `omp_execution: none` — no first-turn precondition.
The plan-level `orchestrate` recommendation (set on the first turn of
the *plan*) already covers the orchestrator contract for the full run.
