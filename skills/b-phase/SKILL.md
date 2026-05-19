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

The most recent `plan-*.md` file in `.context/YYYY-MM-DD.*/` or `.context/plans/`.

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
ralph_complexity: single | multi  # single = likely one Ralph iteration; multi = may need several mini-cycles
goal: "<one sentence>"
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

**Phase file body structure:**
```markdown
# Phase N: <Name>

## Context
<Why this phase exists, what it builds on>

## Implementation Details
<Step-by-step instructions from the plan, adapted to this phase's scope>

## Risks
<Phase-specific risks and mitigations>

## Verification
<How to verify this phase is complete>

## Ralph Mini-Cycle Instructions

If executing this phase inside a Ralph loop:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` before calling `ralph_done`; if the phase is incomplete, leave `status: in-progress` so the next Ralph iteration resumes here.
```

**Status flow**: `pending` → `in-progress` (when b-build/b-build-hard picks it up) → `completed` (when all acceptance criteria pass)

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

| Phase | Status | Difficulty | File |
|-------|--------|------------|------|
| 1: <Name> | pending | medium | [phase-1-<slug>.md](phase-1-<slug>.md) |
| 2: <Name> | pending | easy | [phase-2-<slug>.md](phase-2-<slug>.md) |
| N: <Name> | pending | hard | [phase-N-<slug>.md](phase-N-<slug>.md) |

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

1. Complete Phase 1, verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2, repeat...

## Ralph Workflow Instructions

Use this overview as Ralph's durable navigation map. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
5. Run `/b-save` before `ralph_done` so memory, draft commits, phase state, and review/iteration artifacts are durable.
6. If interrupted mid-cycle, leave the phase file `status: in-progress`; the next Ralph iteration resumes from that phase and any active `iterate-*.md` artifact.

## Ralph Execution Checklist

- [ ] Phase 1: <Name> — build → review → iterate if needed → save
- [ ] Phase 2: <Name> — build → review → iterate if needed → save
- [ ] Phase N: <Name> — build → review → iterate if needed → save

## Notes

- <any warnings, gotchas, or context for future agents>
```

**Critical**: The overview file links to discrete phase files. All implementation details live in the phase files. The overview is a scannable index.

### Ralph Instructions Template

Use this canonical text when creating Ralph-ready phased output. Adapt the phase names and checklist length to the actual phase set, but preserve the cycle and interruption rules:

```markdown
## Ralph Workflow Instructions

Use this overview as Ralph's durable navigation map. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
5. Run `/b-save` before `ralph_done` so memory, draft commits, phase state, and review/iteration artifacts are durable.
6. If interrupted mid-cycle, leave the phase file `status: in-progress`; the next Ralph iteration resumes from that phase and any active `iterate-*.md` artifact.

## Ralph Execution Checklist

- [ ] Phase 1: <Name> — build → review → iterate if needed → save
- [ ] Phase 2: <Name> — build → review → iterate if needed → save
```

For a non-phased plan, use the same mini-cycle with the whole plan as a single unit: `/b-build` → `/b-review` → `/b-iterate` if needed → `/b-save` → `ralph_done`.

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
- Ralph invocation hint: start a Ralph loop with the phases overview as the task source, and have each iteration follow build → review → iterate if needed → save → `ralph_done`

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
- **Before `b-build`**: If a `plan-*-phases.md` overview exists, read it to find the first non-completed phase, then read that discrete phase file for implementation details
- **During `b-build`/`b-build-hard`**: Mark the phase file `status: in-progress`, then `status: completed` when done; update the overview summary table
- **Ralph loops**: Ralph can use the overview and discrete phase files as durable state. Each iteration should execute the active phase mini-cycle, run `/b-save`, and call `ralph_done`; incomplete phases remain `in-progress` for resume.
- **After phase completion**: Run `b-save` (which consolidates phase state), then queue the next phase from the backlog

## Resume Behavior

Any b-* command can pick up where work left off:
1. Read the phases overview (`plan-*-phases.md`)
2. Find the first non-completed phase in the summary table
3. Read that discrete phase file for full implementation details
4. Execute

This works even with zero conversation history — a cold-start agent gets full context from the phase file.
