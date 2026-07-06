---
name: b-loop
description: Set, change, or clear the autonomous execution loop on an existing phased plan. Recommends `none | orchestrate | workflow | goal` from plan shape and stamps `omp_execution` / `omp_goal_budget` onto the chosen phase files (and the matching `omp_execution` cell in the phases-overview `## Phase Summary` table) so the user knows what to drop on the first turn. Advisory + stamp only — does not run or drive a loop. Load with /skill:b-loop or by name.
---

# b-loop: Set the Execution Loop on a Phased Plan

Apply or change the autonomous-execution primitive attached to an existing
phased plan. The loop itself is the same generic mini-cycle already documented
across `b-build` / `b-review` / `b-iterate` / `b-docs` / `b-save` /
`b-commit`:

```
build → review → iterate (if in-plan issues) → docs (if doc impact) → save → commit → done
```

`b-loop` does **not** drive that cycle. It picks which harness primitive
(`none`, OMP `orchestrate` keyword, OMP `workflow` keyword, or OMP `/goal`
session) the user invokes on the first turn of each phase, and stamps the
choice onto each phase file's frontmatter (and the matching cell in the
phases-overview table) so `/b-build` / `/b-iterate` / `/b-review` surface it
at start-of-phase.

## Surface — No Slash Command Mirror (Deferral)

This skill is shipped as **SKILL.md only**. There is no `prompts/b-loop.md`
and no `commands/b-loop.md` symlink in this revision. Invoke it by loading
the skill (`/skill:b-loop`, `load_skill name=b-loop`, or however the active
harness resolves skills by name) rather than via `/b-loop` slash discovery.

**Why deferred.** Other `b-*` skills expose slash surfaces via a paired
`prompts/<name>.md` + `commands/<name>.md` symlink (Pi / OMP convention;
see `docs/buck-workflow.md#runtime-package-mapping`). Adding the mirror
is mechanical — copy the description, add the two files — and is
intentionally not done in this revision at the user's request. The
deferral is recorded in `.context/memory/` and `.context/backlog/`;
a follow-up can lift it without rewriting the skill body, only the
registry surface.

**Practical consequence.** Until the mirror is added:

- `/b-loop` does **not** appear in Pi's `/`-menu nor OMP's `/`-menu.
- Calling `/skill:b-loop` (skill-by-name) **does** work; agents load it
  the same way they load any other skill.
- A wrapping agent (or `b-build` / `b-review` after the plan-shape
  recommendation rule is extended) can also invoke `b-loop` programmatically
  by name — that path is unaffected.

## What this skill replaces

This skill fills the gap that previously motivated the deprecated `b-flow`
extension: "given a phased plan, what loop should I run?" — but does it as a
prompt-level advisory, not a persistent orchestrator. It writes only to
existing `omp_execution` / `omp_goal_budget` fields on phase frontmatter,
plus the matching `omp_execution` cell in the phases-overview
`## Phase Summary` table when one exists.
There is no `orchestration.json` state file, no XState machine, no worker
subagent. The `extensions/b-flow/` historical code (2026-06-01 deprecation)
stays unwired.

## When to Use

- After `/b-phase` produces a phased plan and you want to choose a loop primitive.
- After a phased plan is imported from elsewhere (e.g. a brainstorm or an
  earlier project) and the `omp_execution` column is still blank.
- Any time you want to change an existing phase's loop primitive (e.g.
  switch a phase from `orchestrate` to `goal`).

Skip for non-phased plans (`plan-*.md` without `plan-*-phases.md`) — the
mini-cycle still applies but there is nothing to stamp. Just run the
sequence by hand.

## Harness Note

This skill's primary value is **OMP autonomous-loop
primitives** (`/goal set`, `orchestrate`, `workflow` keywords), which
require OMP. On Pi / Claude Code / OpenCode / Codex:

- All recommendations resolve to `none` (recommended) by default — the
  generic mini-cycle runs identically under any harness.
- The skill still safely runs: when the recommendation is `none`, it
  simply omits `omp_execution` entirely (default is omitted — see the
  field semantics table below) and the loop is then user-driven,
  exactly like the non-OMP-OPT path already documented in
  `docs/buck-workflow.md#omp-autonomous-loops`.
- Detect the active harness from session/runtime state — `omp.runtime`
  or `pi.runtime` are typical signals. **Do not** probe `package.json`'s
  `omp` field for this purpose: this package always declares `omp`
  regardless of which harness loads it. If unsure, default to `none`
  (recommend the generic mini-cycle).

The skill never auto-invokes a keyword on the user's behalf. omp's
`agent-session.ts:4274` guards `if (!options?.synthetic)`, so the user
must type the keyword themselves; `b-loop` only **stamps the
recommendation** and prints the precondition sentence they should see
on the first turn.

## Input

`b-loop` accepts the plan from **any of four entrypoints** — pick the
first one that matches how the user is invoking the skill:

| # | Entrypoint | Trigger |
|---|---|---|
| 1 | **Explicit plan path** | User passed a path to a `plan-*.md`, `plan-*-phases.md`, or `phase-N-*.md` file directly. |
| 2 | **Explicit subject folder** | User passed a path to a `.context/YYYY-MM-DD.<subject>/` directory. |
| 3 | **Existing conversation context** | User says things like "this plan", "the current phases", or the active phase / overview is already in chat history. |
| 4 | **Buck-session artifacts** | `.context/workflow/current-session.json` exists with a `memory_file` pointing at a memory file whose frontmatter carries a `subject:` (read the subject from there), **or** `.context/workflow/orchestration.json` exists with a `currentState` other than `idle/done/aborted` and a `subject` field (use it). |

When invoked through `/skill:b-loop`, **argument tokens are treated as a
path** (entrypoint 1) — so `/skill:b-loop path/to/plan-x.md` works and
explicit positional paths skip subject-resolution entirely. When invoked
by a wrapping agent, inline text is the argument.

**Argument shapes:**

```
b-loop [goal|orchestrate|workflow|none|clear]
b-loop [goal|orchestrate|workflow|none|clear] <path-to-plan-or-phase-or-subject>
```

- **No argument** → advisory mode (resolution falls through entrypoints
  2 → 3 → 4 → stops and asks). Read the plan, propose a primitive per
  the recommendation table below, ask the user to confirm, then stamp.
- **`goal | orchestrate | workflow | none`** (no path) → force mode
  against whatever entrypoint 2/3/4 resolved to. Stamps the requested
  primitive onto every non-completed phase without asking.
- **`goal | orchestrate | workflow | none` `<path>`** → force mode
  against that path (entrypoint 1).
- **`clear`** (no path) → revert mode against whatever resolved; remove
  `omp_execution` and `omp_goal_budget` from every phase file.
- **`clear <path>`** → revert against that specific plan.
- **`<path>`** (no primitive) → advisory mode against that path.

`<path>` may be:

- `plan-*.md` (non-phased — see "Non-phased plans")
- `plan-*-phases.md` (phased; the phases-overview file)
- `phase-N-*.md` (a single discrete phase — bulk-stamps just that one
  phase, **and** mirrors its row in the sibling `plan-*-phases.md`
  `## Phase Summary` table when the overview file exists in the same
  subject folder; see Step 3b clause 6 for the single-row variant)
- A subject folder `.context/YYYY-MM-DD.<subject>/` (resolve the active
  phased plan inside it)

If entrypoint 1 (explicit path) didn't match, apply the shared protocol
at `skills/_shared/subject-resolution.md`. That protocol already
implements entrypoints 2, 3, and 4 in priority order:

1. Subject folder passed as argument (entrypoint 2).
2. b-flow `orchestration.json` if active (entrypoint 4's variant — note:
   b-flow is deprecated; this path is read-only and falls back).
3. `current-session.json` → `memory_file` → `subject:` frontmatter
   (entrypoint 4's other variant).
4. Conversation context / scan of `.context/*/index.md` (entrypoint 3).

Once a subject is resolved, the resolved folder becomes the source for
all subsequent plan / phases-overview / discrete-phase reads.

**STOP and ask** if entrypoint 1 is empty and entrypoints 2-4 are all
empty. Do not guess.

## Workflow

### Step 1: Resolve and load

1. **Pick the entrypoint** in priority order — first non-empty wins.
   Read **Input** above for the full table; in short:

   a. **Explicit path** argument (a `plan-*.md`, `plan-*-phases.md`,
      `phase-N-*.md`, or subject folder passed by the user).
   b. **Explicit subject folder** argument.
   c. **Conversation context** — a phased plan, overview, or phase that
      is already mentioned in chat history; read it directly from
      wherever the user pointed.
   d. **Buck-session artifacts** — read
      `.context/workflow/current-session.json` for `memory_file`,
      follow it to the memory file's `subject:` frontmatter, and use
      that subject. If `current-session.json` is absent, fall back to
      `.context/workflow/orchestration.json`'s `subject` field (only
      when `currentState != idle/done/aborted`; b-flow is deprecated,
      but the file is read-only-safe).

   If all four sub-entrypoints (a–d) are empty, **STOP and ask** — do
   not guess.

2. Once a subject (or path) is resolved, read `.context/<subject>/index.md`
   if present — it links to all artifacts in the subject.
3. Locate the plan files in this order (first hit wins):
   - `plan-*-phases.md` + `phase-N-*.md` (discrete phased plan)
   - `plan-*-phases.md` (single-file phased plan, legacy)
   - `plan-*.md` (non-phased — see "Non-phased plans" below)
4. For phased: parse all `phase-*.md` frontmatter into a small table
   `(N, status, difficulty, omp_execution, omp_goal_budget)`.
5. Read the parent plan's `## User Goal` (if present) — it is referenced
   in the goal-mode precondition sentence.

### Step 2: Recommend (advisory mode only)

If the argument is empty, apply the recommendation table below to the
plan and propose one primitive. Pick the **strongest** that matches;
stronger beats weaker.

| Trigger (plan-shape signal) | Recommend | Rationale |
|---|---|---|
| Active harness is not OMP | `none` (omit) | Prevents recommending a primitive the harness cannot invoke. |
| Phased plan with **≥ 4 phases** AND **≥ 1 HARD dependency** between any pair | `orchestrate` | The orchestrator contract ("do not yield between phases", "parallelize maximally", "verify after every phase") maps to phased work with hard gates. |
| Plan title / scope / affected files contain `review`, `audit`, `sweep`, `migrate`, or `coverage-check` | `workflow` | Cross-cutting review/audit work benefits from `eval`-cell fan-out with a budget ceiling. The user edits `eval-<topic>.py` before invoking. (If no eval cell exists in the subject folder, recommend `orchestrate` instead — `workflow` requires the cell.) |
| Plan User Goal is one sentence with no clear phase boundary AND total work is one persistent objective | `goal` | A single `/goal` session is the right envelope when the work is unified. The plan's phases compete for one budget. |
| Non-phased, single-session, bounded, low-risk | `none` (omit) | Default. No opt-in. |
| All other cases | `none` (omit) | Default. No opt-in. |

**`omp_goal_budget` rubric** (use when recommending `goal`):

- `4_000` per easy phase, `8_000` per medium phase, `16_000` per hard phase,
  summed across the plan and rounded to the nearest 5k.
- For non-phased plans, default to `12_000` tokens.
- The user can override; the field is a hint.

Present the recommendation as a short table:

```
Recommended loop for <plan title>:
  none         — single-session manual cycle (default)
  orchestrate  — matches: ≥4 phases with HARD deps
  workflow     — not applicable (no eval-<topic>.py in subject)
  goal         — would estimate budget = 4k+8k+16k = 28k → 30k tokens

Recommended: orchestrate. Apply? [y/n/choose-another]
```

If the user says "no" or chooses another, apply the rule table again from
their choice (skip the trigger they overrode; keep the rest).

### Step 3: Stamp (any mode)

**3a. Phase files.** For each `phase-N-*.md` in the active plan where `status != completed`:

1. Read its current frontmatter.
2. **Remove** any existing `omp_execution` and `omp_goal_budget` keys
   (they live at the same indentation level as `difficulty`).
3. If the chosen primitive is not `none`, **insert** `omp_execution: <value>`
   in the conventional slot (between `buck_hint` and `goal:`, mirroring
   `b-phase`'s order at `skills/b-phase/SKILL.md:165-166`).
4. If the primitive is `goal`, also insert
   `omp_goal_budget: <rounded-budget>` immediately after `omp_execution`.
5. If the primitive is `workflow`, **verify** `.context/<subject>/eval-<topic>.py`
   exists. If it does not, warn the user and recommend one of:
   - Run `/b-plan` against this plan to write the eval cell (only works
     for newly authored plans), OR
   - Run `/skill:b-plan`'s eval-cell-template behavior manually
     (`skills/b-plan/SKILL.md#eval-cell-template-for-workflow-plans`).
6. Preserve the rest of the frontmatter verbatim, including blank lines
   and ordering of other keys.
7. Preserve the body verbatim.

**3b. Phases-overview table (mirror).** When the plan has a discrete
`plan-*-phases.md` (the only shape that has a `## Phase Summary` table),
update the overview in lock-step so it never disagrees with the phases
it summarizes:

a. Locate the `## Phase Summary` table that `b-phase` writes (column
   shape: `| Phase | Status | Difficulty | omp_execution | File |`,
   see `skills/b-phase/SKILL.md:268-275`).
b. For each affected phase row, set the `omp_execution` cell to the
   chosen `<value>`. Important: the table cell carries the **literal
   string `none`** when the choice is `none` — do **not** leave the
   cell empty. This mirrors `b-phase`'s own template behavior at
   `skills/b-phase/SKILL.md:271-275` (each new row is seeded with
   `| ... | none | [phase-N-slug.md](phase-N-slug.md) |`). The
   per-phase frontmatter key remains omitted when the value is
   `none`; only the overview cell carries the literal. Append
   `(budget: <n>)` to the cell when the value is `goal` and the
   budget is non-null.
c. Preserve everything else in the table verbatim — column order,
   surrounding prose, status column values, file links, ASCII
   alignment in source (recompute the cell width to match the
   column header so the rendered table still lines up).
d. **Skip cleanly** when the table lacks an `omp_execution` column
   (rare; older plans written before the column was added). Do
   **not** add the column here. Surface it in the closeout report
   so the user or `b-save` can normalize the table on the next pass.
e. **Skip cleanly** when no phases-overview file exists (only
   `phase-N-*.md` siblings). The per-phase frontmatter is the
   source of truth in that case.
f. **Single-phase variant.** When the invocation entrypoint was a
   single `phase-N-*.md` (see Input), mirror **only that one row**
   in the overview table. Identify the row by matching the cell
   text in the `File` column against the phase file's basename
   (`[phase-N-slug.md](phase-N-slug.md)`). Do not stamp any other
   phase row in the table. The per-phase frontmatter keys of
   sibling phases are likewise left untouched (Step 3a implicitly
   scopes to the same single phase).

**Field semantics** (forwarded from `b-phase` so the rest of the
workflow reads them consistently):

| `omp_execution` | What the user does on the phase's first turn |
|---|---|
| `none` (or omit) | Plain first turn — standard Buck build cycle. |
| `orchestrate` | Type the `orchestrate` keyword anywhere in the first turn. omp injects the orchestrator contract. |
| `workflow` | Open `.context/<subject>/eval-<topic>.py`, run the cell, then type the `workflow` keyword in the first turn. |
| `goal` | Run `/goal set <plan User Goal> --budget <omp_goal_budget>` first; then proceed under active goal mode. |

### Step 4: Emit per-phase precondition

After stamping, for each affected phase **print** (do not write to disk)
the precondition sentence that matches `b-phase`'s per-phase first-turn
expansion at `skills/b-phase/SKILL.md:227-234`, rewritten
loop-agnostically per the active `loop-agnostic-execution-loops`
backlog item (no "Ralph" proper noun, no `ralph_done`):

| `omp_execution` | First-turn precondition (emitted in chat) |
|---|---|
| `orchestrate` | "Type the `orchestrate` keyword anywhere in your first turn of this phase. omp will inject the orchestrator contract (parallel `task` subagents, no-yield between phases, verify-after-every-phase)." |
| `workflow` | "Open `.context/<subject>/eval-<topic>.py`, run the cell, then type the `workflow` keyword in your first turn. The eval kernel fans out one `agent()` per phase." |
| `goal` | "Run `/goal set <plan User Goal> --budget <omp_goal_budget>`, then begin the build. The active goal persists across turns and triggers the 6-step completion-audit on `goal({op:'complete'})`." |
| `none` | (no precondition — plain first turn, standard Buck build cycle) |

### Step 5: Closeout

Print a short report:

```
Loop applied to <plan title>:
  Phase 1: <name> — omp_execution: orchestrate (was: none)
  Phase 2: <name> — omp_execution: goal, omp_goal_budget: 30000 (was: none)
  ...

Total: N phase files stamped, M skipped (already completed), K unchanged.
Overview: <plan-*-phases.md> updated in K rows / 0 cells added / <skip reason if not updated>

Next steps (per phase):
1. Open Phase 1 in your next turn.
2. <emitted precondition sentence>
3. Run /b-build <plan or phase file>.
4. /b-review → /b-iterate if issues → /b-docs if doc impact → /b-save → /b-commit.

To change: /skill:b-loop [goal|orchestrate|workflow|none|clear]
To verify: open any phase file and read its frontmatter; cross-check the
         Phase Summary table in plan-*-phases.md.
```

The `Overview:` line is always present; if the mirror step was skipped
(see Step 3b clauses 4 and 5), state the reason explicitly so the user
knows the overview is stale or absent.

## Non-phased Plans

If the subject has only `plan-*.md` (no phases overview), there is no
frontmatter to stamp:

1. Read the plan and apply the recommendation table above.
2. Print the precondition sentence for the recommended primitive in chat.
3. Recommend the user drive the mini-cycle by hand
   (`/b-build → /b-review → /b-iterate → /b-docs → /b-save → /b-commit`).
4. Do not write anything; there is no field to stamp.

If the user really wants a loop primitive on a non-phased plan, suggest
`/b-phase` first — phased plans are the surface this skill operates on.

## Resuming an In-Progress Phase

If a phase has `status: in-progress`, leave its existing `omp_execution`
and `omp_goal_budget` untouched unless the user explicitly passes
`goal | orchestrate | workflow | none | clear`.
Resume behavior is owned by `b-build` / `b-iterate` / `b-review`; this
skill is read+stamp only for live phases.

## Boundaries

- **No new orchestrator.** This skill writes only `omp_execution` /
  `omp_goal_budget` keys on phase frontmatter (plus the matching
  `omp_execution` cell in the phases-overview `## Phase Summary` table).
  It does **not** create `orchestration.json`, run workers, advance
  state, or otherwise drive the loop. The mini-cycle is the user's
  responsibility.
- **No slash command mirror.** Shipped as SKILL.md only; load by name or
  through `/skill:b-loop`. See "Surface — No Slash Command Mirror" above.
- **No auto-keyword.** This skill does **not** type `orchestrate`,
  `workflow`, or `/goal set` on the user's behalf. omp's
  `agent-session.ts:4274` makes synthetic typing a no-op anyway; we
  only stamp the recommendation.
- **No cross-harness breakage.** Every output is the same generic
  mini-cycle plus an optional OMP-keyword precondition. On non-OMP
  harnesses, the precondition is silently skipped and the recommendation
  resolves to `none`.
- **No plan-level mutation.** This skill does not write to the plan's
  frontmatter (`memory:`, `iterations:`, etc.) — those are owned by
  `b-save`. The one allowed mutation outside `phase-N-*.md` is the
  `omp_execution` cell in the phases-overview `## Phase Summary` table —
  that is updated in lock-step with the per-phase frontmatter (Step 3b)
  so the overview never disagrees with the phases it summarizes.
- **Idempotent.** Re-running with the same primitive is a no-op
  (fields stay the same, table cells stay the same). Re-running with
  a different primitive overwrites the previous choice cleanly,
  including the overview table.

## Cross-References

- `skills/b-phase/SKILL.md` — owns phase-file frontmatter (source of
  `omp_execution` / `omp_goal_budget` field definitions and per-phase
  precondition sentence shape) and the `## Phase Summary` table shape
  in `plan-*-phases.md` (`skills/b-phase/SKILL.md:268-275`).
- `skills/b-plan/SKILL.md` — owns the plan-level recommendation table
  this skill reuses (see `OMP Execution Recommendation`).
- `skills/b-build/SKILL.md`, `skills/b-review/SKILL.md`,
  `skills/b-iterate/SKILL.md` — read `omp_execution` from phase
  frontmatter to surface the precondition at start-of-phase.
- `docs/buck-workflow.md#omp-autonomous-loops` — full contract for the
  three OMP primitives; safe cross-harness guard.
- `docs/buck-workflow.md#runtime-package-mapping` — explains the
  `prompts/<name>.md` + `commands/<name>.md` symlink pattern this skill
  intentionally does not register in this revision.
- `.context/2026-06-01.deprecate-b-flow/` — the lesson this skill exists
  to honor: extension-based orchestration becomes dead weight without
  observable invocation.
- `.context/backlog/items/loop-agnostic-execution-loops.md` — active
  refactor making mini-cycles loop-agnostic. The precondition sentences
  this skill emits follow that direction (no Ralph-specific wording).
