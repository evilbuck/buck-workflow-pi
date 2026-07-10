---
name: b-phase
description: Analyze a plan and break it into sequential phases if it is too large to execute in one session. Use when a plan has many steps, touches many files, spans multiple domains, or when b-plan recommends phasing. Trigger with /skill:b-phase or after writing any plan-* file.
---

# b-phase: Plan Phasing Skill

Break large plans into sequential, independently-verifiable phases. Each phase should be completable in one agent session.

## When to Phase a Plan

A plan is "too large" when any of these apply:
- **Step count**: More than ~8 implementation steps
- **File spread**: Touches more than ~5 distinct files or directories
- **Domain crossing**: Involves multiple architectural layers (DB + API + UI)
- **Risk surface**: Changes critical paths (auth, billing, data migrations)
- **Unknowns**: Contains research or spike steps that could expand scope
- **Verification burden**: Testing/verification steps alone would exhaust context

Use **judgment**: if completing the plan in one session feels risky or cramped, phase it.

## Input

## Subject Resolution
Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If the protocol resolves a subject, use it for plan discovery.
If the protocol finds no subject, fall back to scanning for the most recent `plan-*.md`.

## Workflow

### Step 1: Read the Plan

```bash
# Find the most recent plan
ls -lt .context/*.* 2>/dev/null | head -5
ls -lt .context/plans/ 2>/dev/null | head -5
```

Read the full plan file. Note:
- Total steps
- Files affected
- Dependencies between steps
- Verification criteria
- **User goal** (if the plan has a `## User Goal` section) — see Step 1b below

### Step 1b: User Goal Inheritance

Read the parent plan's `## User Goal` section. This is the user-facing north star for the entire phased plan.

**Default behavior: inherit.**
- Do not require per-phase user goals. Phases are slices of a single user-facing outcome, not separate user stories.
- Carry the parent plan's user goal forward into each phase file by reference (e.g. in the phase file's `## Context` section, restate the parent goal in one line so each phase stands alone).

**Optional per-phase refinement.**
- If a phase would benefit from its own refined sub-goal (e.g., the phase delivers a distinct user-facing increment or a sub-set of users), propose it to the user and ask for confirmation before recording it.
- If per-phase goals are created, record them in the phase file's body using the same `## User Goal` format as plans (verbatim text, or `Technical chore — <reason>` waiver).

**Why inherit by default**: a phased plan is one user-facing outcome executed in slices. Forcing a separate user goal per phase duplicates work, fragments the narrative, and encourages checkbox-style "user goals" that carry no real meaning. Inheritance keeps the user-facing intent unified; refinement is opt-in for phases that genuinely serve distinct sub-users.

### Step 2: Assess Size

Apply the "When to Phase" criteria above. Decide:
- **SKIP**: Plan is small enough — no action needed
- **PHASE**: Plan needs breaking up

If skipping, tell the user: *"This plan looks executable in one session. No phasing needed."*

### Step 2b: Check Grill Session Metadata

If `grill-session-*.md` files exist in the subject folder, read them for additional sizing signals:

**What to look for:**
- `total_questions`: High count alone doesn't mandate phasing — look for boundary-crossing
- `boundary_assessment`: If `boundaries_found`, treat as strong signal to phase; if `cohesive`, the plan is large but unified
- `decision_domains`: Natural grouping boundaries — these often map directly to phases
- `break_points`: Already-identified split points from the grilling session
- `deferred` / `blocked` questions: Unresolved areas that add risk and complexity

**How to use it:**
- If `boundary_assessment: boundaries_found`, treat as strong signal to phase
- If `boundary_assessment: cohesive`, the plan is large but unified — still phase if other criteria apply (step count, file spread, risk)
- Use `decision_domains` as starting phase boundaries (the model already identified these during grilling)
- Use `break_points` as candidate phase dividers
- Cross-reference: do the grill session domains align with the plan's implementation steps? Adjust if needed.

If no grill session exists, proceed with Step 3 using only the plan file.

### Step 3: Identify Dependencies

Before grouping steps, map the dependency graph:

**What creates phase dependencies?**
- **Data/schema**: Phase B needs a table/model created in Phase A
- **API contract**: Phase B calls an endpoint/interface defined in Phase A
- **Shared state**: Phases mutate the same file or configuration
- **Build order**: Phase B's code won't compile without Phase A's types/exports
- **Test infrastructure**: Phase B needs test harnesses set up in Phase A
- **Feature flag**: Phase B's work is gated behind a flag created in Phase A

**Dependency types:**
- **HARD**: Phase N cannot start until Phase N-1 completes (blocking)
- **SOFT**: Phase N can start with stubs/mocks, but needs Phase N-1 for full integration
- **NONE**: Phases are independent and could be done in parallel

**Document each dependency:**
```
Phase X → Phase Y: [HARD|SOFT] because <specific reason>
```

If you find many HARD dependencies, reconsider phase boundaries — aim for SOFT or NONE.

### Step 4: Design Phases

Group plan steps into phases using the dependency map:

1. **Vertical slices preferred**: Each phase should produce a working, testable increment
2. **Minimize cross-phase dependencies**: Later phases should not block earlier ones
3. **Keep phases roughly equal in size**: Avoid one giant phase and many tiny ones
4. **Preserve verification**: Each phase must have its own acceptance criteria
5. **Front-load risk**: Put high-uncertainty steps in early phases to fail fast
6. **Data before code**: Migrations and schema changes before business logic
7. **Respect hard dependencies**: If Phase B HARD-depends on Phase A, they must be sequential
8. **Flag parallel opportunities**: If two phases have NO dependency between them, note it — they could be executed in parallel by separate agents
9. **Assign a model hint to every phase**: label each phase `easy`, `medium`, or `hard`

### Phase Difficulty / Model Hint Rubric

Use this simple rubric for each phase:

- **easy** — bounded, local, mostly mechanical work; low ambiguity; verification is straightforward
  - **Model hint**: smaller/faster general model is fine
  - **Buck execution hint**: usually `/b-build`
- **medium** — some cross-file reasoning, moderate risk, or non-trivial verification
  - **Model hint**: capable general model preferred
  - **Buck execution hint**: usually `/b-build`, escalate to `/b-build-hard` if ambiguity appears
- **hard** — ambiguous, architecture-touching, failure-sensitive, or high-blast-radius work
  - **Model hint**: strongest reasoning model available
  - **Buck execution hint**: use `/b-build-hard`

Prefer the simplest label that honestly matches the phase. Do **not** hard-code provider-specific model IDs unless the user explicitly asked for them.

Phase naming: `Phase 1: <Short Name>`, `Phase 2: <Short Name>`, etc.

### Step 5: Write Phase Files

Create **two types of output** in the same directory as the original plan:

#### 5a. Discrete Phase Files (one per phase)

Create `phase-N-<slug>.md` for each phase.

**Phase file frontmatter:**
```yaml
---
status: pending
phase: N
order: N
plan: plan-<topic>.md
phases_overview: plan-<topic>-phases.md
difficulty: easy | medium | hard
model_hint: <description>
buck_hint: /b-build | /b-build-hard
goal: "<one sentence>"
omp_execution: none | orchestrate | workflow | goal  # see "omp_execution" below; default omitted (= none)
omp_goal_budget: <tokens>                            # only meaningful when omp_execution: goal
files: [path/to/file1, path/to/file2]
from_plan_steps: [3, 4, 5]
depends_on: [1]           # phase numbers; empty [] if none
dependency_type: HARD | SOFT | NONE
acceptance_criteria:
  - "[ ] <checkable outcome>"
  - "[ ] <checkable outcome>"
completed_at: null
completed_by: null
---
```

**`omp_execution` field.** Optional. Default is `none` (omit the field entirely).
When set, it tells the user running the phase how to opt in: `orchestrate`/`workflow`
are first-turn keywords the user types; `goal` means the user runs `/goal set` before
the build. **The field is a recommendation to the user, not runtime state the agent
can enforce** — omp's `agent-session.ts:4274` guards `if (!options?.synthetic)`, so
the user must type the keyword (or run `/goal set`) themselves.
See `docs/buck-workflow.md#omp-autonomous-loops` for the full contract.

| Value | What the user does on the phase's first turn |
|---|---|
| `none` (or omit) | Plain first turn — standard Buck build cycle. |
| `orchestrate` | Type the `orchestrate` keyword anywhere in the first turn. omp injects the orchestrator contract. |
| `workflow` | Type the `workflow` keyword in the first turn after running the `eval-<topic>.py` cell b-plan wrote into the subject folder. |
| `goal` | Run `/goal set <objective> --budget <omp_goal_budget>` first; then proceed under active goal mode. |

**`omp_goal_budget` field.** Optional companion to `omp_execution: goal`. Hints
at the recommended `token_budget` to set on the `/goal` session. The user
sets the actual budget when they run `/goal set`. The plan's recommendation
rule of thumb: `4_000` per easy phase, `8_000` per medium phase, `16_000`
per hard phase, summed across the plan (rounded to nearest 5k).
**Phase file body structure:**
```markdown
# Phase N: <Name>

## User Goal
<!-- Optional. By default, inherit the parent plan's user goal — do not duplicate it here. Only include a `## User Goal` section if this phase delivers a distinct user-facing increment; restate the inherited parent goal in `## Context` so the phase stands alone. Format: <who benefits and what changes for them>, or `Technical chore — <reason>`. -->

## Context
<Why this phase exists, what it builds on. If the plan has a `## User Goal`, restate it in one line here so this phase file stands alone.>

## Implementation Details
<Step-by-step instructions from the plan, adapted to this phase's scope>

## Risks
<Phase-specific risks and mitigations>

## Verification
<How to verify this phase is complete>

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`; it closes the phase only from the matching valid review-pass, promotes exactly the next dependency-ready phase, and prints the changed-path staging checklist.
5. Explicitly stage the listed implementation and durable artifact paths, then run `/b-commit`.
6. If the phase is incomplete or save refuses closeout, leave `status: in-progress` so the session resumes here next turn.

If the phase's frontmatter declares `omp_execution: orchestrate | workflow | goal`,
expand step 1 above with a one-liner **before** the build command runs:

| `omp_execution` | First-turn precondition |
|---|---|
| `orchestrate` | "Type the `orchestrate` keyword anywhere in your first turn of this phase. omp will inject the orchestrator contract (parallel `task` subagents, no-yield between phases, verify-after-every-phase)." |
| `workflow` | "Open `.context/<subject>/eval-<topic>.py`, run the cell, then type the `workflow` keyword in your first turn. The eval kernel fans out one `agent()` per phase." |
| `goal` | "Run `/goal set <plan User Goal> --budget <omp_goal_budget>`, then begin the build. The active goal persists across turns and triggers the 6-step completion-audit on `goal({op:'complete'}).`" |
```

**Status flow**: `pending` → `in-progress` (b-build/b-build-hard) → review-pass evidence (b-review) → `completed` (b-save only)

#### 5b. Phases Overview File (index + dependency matrix)

Create `plan-<topic>-phases.md` as a **lightweight index**.

**Overview frontmatter:**
```yaml
---
status: active
date: YYYY-MM-DD
subject: <same as plan>
topics: [phasing, <plan topics>]
source_plan: plan-<topic>.md
phases: N
format: discrete
---
```

**Overview body structure:**
```markdown
# Phased Plan: <Topic>

> Derived from [plan-<topic>.md](plan-<topic>.md)

## Overview

- **Total phases**: N
- **Rationale**: <one sentence why this was phased>
- **Estimated total effort**: <rough estimate>
- **Difficulty mix**: <e.g. 1 easy, 2 medium, 1 hard>

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: <Name> | pending | medium | none | [phase-1-<slug>.md](phase-1-<slug>.md) |
| 2: <Name> | pending | easy | none | [phase-2-<slug>.md](phase-2-<slug>.md) |
| N: <Name> | pending | hard | none | [phase-N-<slug>.md](phase-N-<slug>.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | <specific reason> |
| Phase 2 → Phase 3 | SOFT | <specific reason> |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3
    │           │
    └───────────┘
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)
- `│` = shared resource/file

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: <specific reason>
- Phase 3 SOFT-depends on Phase 2: <specific reason>

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

- **Phase X ∥ Phase Y**: Both are independent — no shared files, no build-order dependency
  - *Rationale*: <why they are independent>
  - *Caveat*: <any context they still share, e.g., same config file>

## Execution Order

1. Build Phase 1, leaving it `in-progress` with acceptance criteria unchecked
2. Run `/b-review` against the exact phase until it writes a valid review-pass
3. Run `/b-save`; save checks verified criteria, completes the phase and overview row, and promotes exactly the next dependency-ready backlog item
4. Explicitly stage the reported paths, commit the phase, then repeat

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Select the single `in-progress` phase before any later `pending` phase.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save`; only a matching valid review-pass may complete the phase, update the overview/backlog, and promote the next dependency-ready phase.
6. Explicitly stage the paths reported by save, then run `/b-commit` before building the promoted phase.
7. If interrupted or save refuses closeout, leave the phase file `status: in-progress`; resume it with any active `iterate-*.md`.
**Commit invariant**: one phase completion equals one commit. Never batch completed phases; save owns completion/promotion and commit follows the explicit staging gate.

## Execution Checklist

- [ ] Phase 1: <Name> — build → review → iterate if in-plan issues → docs if doc impact → save → stage → commit
- [ ] Phase 2: <Name> — build → review → iterate if in-plan issues → docs if doc impact → save → stage → commit
- [ ] Phase N: <Name> — build → review → iterate if in-plan issues → docs if doc impact → save → stage → commit


### Step 5c: Update Plan Status

After creating phase files and the phases overview:
1. **Update the plan file's frontmatter**: set `status: active` if it is currently `draft`
2. **Update `index.md` in the subject folder**: set `status: active`

## Notes

- <any warnings, gotchas, or context for future agents>
```

**Critical**: The overview file links to discrete phase files. All implementation details live in the phase files. The overview is a scannable index.

### Execution Instructions Template

Use this canonical text when creating execution-ready phased output. Adapt the phase names and checklist length to the actual phase set, but preserve the cycle and interruption rules:

```markdown
## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Select the single `in-progress` phase before any later `pending` phase.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow`, drop the matching keyword on the first turn before the build command. If it is `goal`, run `/goal set "<plan User Goal>" --budget <omp_goal_budget>` first instead. Either way, see the phase file's "Per-Phase Execution Loop" for the precondition.
4. Run `/b-review` against the exact phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), route them separately. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save`; it requires the matching valid review-pass, owns completion/promotion, and prints the changed-path staging checklist.
7. Explicitly stage the reported paths, then run `/b-commit`.
8. If interrupted or save refuses closeout, leave the phase `in-progress` and resume it with any active iterate.

## Execution Checklist

- [ ] Phase 1: <Name> — build → review → iterate if in-plan issues → docs if doc impact → save → stage → commit
- [ ] Phase 2: <Name> — build → review → iterate if in-plan issues → docs if doc impact → save → stage → commit
```

For a non-phased plan, use the same mini-cycle with the whole plan as one unit: `/b-build` → `/b-review` → `/b-iterate` if in-plan issues → `/b-docs` if doc impact → `/b-save` → explicit stage → `/b-commit`. Save closes only from a matching valid review-pass. Out-of-plan findings spawn a separate `/b-plan` → `/b-build` cycle, not an iterate loop.

### Step 6: Update Backlog

If `.context/backlog/` exists:

1. Create per-phase backlog items in `.context/backlog/items/phase-<n>-<slug>.md`
2. Link each to the discrete phase file in their `related:` frontmatter
3. Add only **Phase 1** to `.context/backlog/todo.md` (active queue)
4. Leave remaining phases as `[ ]` entries but commented out or in a "Upcoming Phases" section

If using legacy `.context/backlog.md`:
- Append phases as a new section
- Mark only Phase 1 as active

### Step 7: Summarize

Tell the user:
- How many phases created and why
- Where the overview file and discrete phase files live
- What Phase 1 covers and how to start it
- What difficulty/model hint was assigned to each phase (especially Phase 1)
- That future sessions can resume by reading the overview → finding the first non-completed phase → reading its file
- Execution hint: start an OMP execution session with the phases overview as the task source. If the plan or a phase recommends an `omp_execution` mode (orchestrate/workflow/goal), follow its keyword / `/goal set` precondition on the first turn; otherwise work the phases sequentially. Each phase runs build → review → iterate if in-plan issues → docs if doc impact → save → commit.

## Example: Small Plan (SKIP)

Plan has 4 steps, touches 2 files. **SKIP** — executable in one session.

## Example: Large Plan (PHASE)

Plan has 14 steps across 8 files spanning API, DB, and UI.

**Original plan**: `plan-payment-integration.md` — 14 steps
**Overview file**: `plan-payment-integration-phases.md` (index)
**Phase files**: `phase-1-schema-migrations.md`, `phase-2-api-endpoints.md`, `phase-3-frontend-integration.md`, `phase-4-testing-verification.md`
- Phase 1: Schema & Migrations (3 steps, 2 files) — **medium**
- Phase 2: API Endpoints (4 steps, 3 files) — **medium**
- Phase 3: Frontend Integration (4 steps, 3 files) — **hard**
- Phase 4: Testing & Verification (3 steps, cross-cutting) — **easy**

## Edge Cases

**Plan already has phase-like sections:**
- If the plan is already grouped but groups are too large, sub-divide further
- If groups are appropriately sized, recommend SKIP and suggest using the existing groups as session boundaries

**Plan has only 6 steps but high risk:**
- Phase based on risk, not just step count. A 6-step plan touching auth + billing should still be phased.

**No subject folder exists:**
- Create `.context/YYYY-MM-DD.<topic>/` subject folder first
- Create the overview and phase files within it
- Fallback: `.context/plans/` for legacy projects

## Integration with Buck Workflow

- **After `b-plan`**: `b-plan` should recommend running `b-phase` if the plan exceeds 6 steps or touches 3+ domains
- **Before `b-build`**: If a `plan-*-phases.md` overview exists, select the single `in-progress` phase before any later `pending` phase, then read its discrete file
- **During `b-build`/`b-build-hard`**: Move only `pending → in-progress`; never check acceptance criteria or complete phase/overview state
- **During `b-review`**: Record pass/iterate evidence for the exact target without mutating completion state
- **After accepted work**: Run `/b-docs` if flagged, then `/b-save`; save alone completes verified state and promotes the next dependency-ready backlog item. Explicitly stage save's changed-path checklist before `/b-commit`

## Resume Behavior

Any b-* command can pick up where work left off:
1. Read the phases overview (`plan-*-phases.md`)
2. Prefer the single `in-progress` phase; never skip it for a later `pending` phase
3. Read that discrete phase and any active iterate addressing it
4. Resume its build/review/save cycle

This works even with zero conversation history — a cold-start agent gets full context from the phase file.
