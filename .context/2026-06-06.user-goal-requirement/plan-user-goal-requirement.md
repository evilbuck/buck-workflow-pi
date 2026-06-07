---
status: completed
date: 2026-06-06
subject: 2026-06-06.user-goal-requirement
topics: [user-goal, user-story, plan-quality, brainstorm, review]
research: []
iterations: []
spec:
memory: []
---

# Plan: Require User Goal in Plans and Brainstorms

## User Goal

Developers using buck-workflow always articulate who benefits from their work and what changes for them — before building. This keeps plans user-focused by default and technical chores opt-out.

## Context used / assumptions

- Grilling session produced 8 questions, all resolved. Single domain, no boundary crossing.
- Current skills have no user-facing goal concept. Plans focus on scope/steps/risks but not *why* the work matters to a user.
- Enforcement model is skill instructions — no runtime gates. b-save adds a soft warning.

## Scope

- Add `## User Goal` requirement to `b-brainstorm` and `b-plan` skill instructions
- Add gate-check to `b-build` — flag if plan has no user goal and no waiver
- Add gap analysis verification to `b-review` — compare implementation against user goal
- Add inheritance behavior to `b-phase` — parent goal by default, optional per-phase refinement
- Add soft warning to `b-save` prompt — check for user goal, warn if missing
- Update plan/brainstorm templates to include `## User Goal`

## Out of scope

- No changes to `b-iterate`, `b-research`, `b-explore`, `b-present`
- No extension-level enforcement (runtime gates)
- No new artifact types (no separate `user-story-*.md` files)
- No changes to `commands/` directory (those are zero-byte symlinks)

## Affected files

1. `skills/b-brainstorm/SKILL.md` — add user goal requirement to interview flow and draft template
2. `skills/b-plan/SKILL.md` — add user goal requirement to planning flow and plan template
3. `skills/b-build/SKILL.md` — add gate-check when loading a plan
4. `skills/b-review/SKILL.md` — add user goal gap analysis to review protocol
5. `skills/b-phase/SKILL.md` — add user goal inheritance and optional per-phase refinement
6. `skills/b-save/SKILL.md` — add soft warning responsibility
7. `prompts/b-save.md` — add user goal check to the 10 responsibilities

## Implementation steps

### Step 1: Update b-brainstorm

In `skills/b-brainstorm/SKILL.md`:

- Add a **User Goal** subsection under Core Behavior, before the Interview Flow:
  - MUST ask the user who benefits from this work and what changes for them
  - If the user can't articulate it, synthesize a draft from their loose requirements and ask them to confirm or refine
  - If the user explicitly says "this is a technical chore", record `## User Goal\nTechnical chore — <one-line reason>`
  - This is not optional — the agent always prompts for it

- Update the Draft Format template to include `## User Goal` as the first section after the title:
  ```markdown
  # Plan: <working title>

  ## User Goal
  <who benefits and what changes for them, or: Technical chore — <reason>>

  ## What we might build
  - ...
  ```

- Add to the interview flow: the first substantive question should surface the user goal. Don't treat it as a separate phase — weave it into the natural interview.

### Step 2: Update b-plan

In `skills/b-plan/SKILL.md`:

- Add a **User Goal Requirement** subsection under Behavior:
  - Every plan MUST include a `## User Goal` section
  - If the user or upstream brainstorm already defined one, carry it forward
  - If not defined, synthesize from context and ask the user to confirm
  - If the user waives, record `Technical chore — <reason>`
  - This section is REQUIRED — plans without it are incomplete

- Update the Recommended Plan Structure template to include `## User Goal` immediately after `# Plan: <title>`:
  ```markdown
  # Plan: <title>

  ## User Goal
  <who benefits and what changes for them, or: Technical chore — <reason>>

  ## Goal
  ...

  ## Context used / assumptions
  ...
  ```

- Add to the Clarification Interview Protocol: if the user hasn't provided a user goal and hasn't waived, ask for one before finalizing the plan.

### Step 3: Update b-build

In `skills/b-build/SKILL.md`:

- Add a **User Goal Gate-Check** subsection in the Subject Resolution / plan-loading area:
  - When loading a plan, check for a `## User Goal` section
  - If present: display it at the start as a north star
  - If absent and no waiver: flag it prominently:
    > ⚠️ This plan has no User Goal defined. Consider adding one before building. Run `/b-plan` to update, or proceed if this is intentional.
  - Do not block — just flag. The agent proceeds regardless.

### Step 4: Update b-review

In `skills/b-review/SKILL.md`:

- Add **User Goal Gap Analysis** to the Plan Completion Review Protocol:
  - Parse the `## User Goal` section from the plan
  - Add a row to the completion matrix:

    | Plan Field | What to Verify |
    |---|---|
    | `user goal` | Does the implementation deliver on the user-facing goal? |

  - In the Verification Status section, add:
    - `User goal: <met / partially met / not met> — <evidence>`
  - If user goal is absent, note it as a review finding (not blocking, but a gap)

- Add a **User Goal Gap Analysis** subsection to the output template:
  ```markdown
  ### User Goal Analysis
  - Goal: <the user goal text>
  - Met: <what's covered>
  - Partial: <what's partially addressed>
  - Missing: <what's not addressed>
  - Verdict: <met / partially met / not met>
  ```

### Step 5: Update b-phase

In `skills/b-phase/SKILL.md`:

- Add **User Goal Inheritance** in the Workflow section, after Step 1 (Read the Plan):
  - Read the parent plan's `## User Goal` section
  - Default: inherit the parent goal. Do not require per-phase user goals.
  - Optional: if the agent believes a phase would benefit from its own refined sub-goal (e.g., the phase delivers a distinct user-facing increment), propose it to the user and ask for confirmation
  - If per-phase goals are created, record them in the phase file's `## User Goal` section (same format as plans)

- Add `user_goal:` guidance to the phase file body structure template (optional field)

### Step 6: Update b-save skill and prompt

In `skills/b-save/SKILL.md`:
- Add responsibility 11: **User Goal Check** — scan plan and brainstorm artifacts in the active subject. If any lack a `## User Goal` section and have no waiver, warn the user. Do not block.

In `prompts/b-save.md`:
- Add step 11 to the responsibilities list matching the skill description

## Verification

- Read each modified skill file and confirm:
  - b-brainstorm: `## User Goal` is in the draft template and interview flow
  - b-plan: `## User Goal` is in the plan template and required by behavior rules
  - b-build: gate-check exists and flags missing user goals
  - b-review: gap analysis section exists in review protocol and output template
  - b-phase: inheritance behavior documented
  - b-save: responsibility 11 added to skill and prompt
- All templates include `## User Goal` in the correct position

## Risks

- **Low risk**: All changes are to Markdown skill files and a prompt template. No code changes, no extensions.
- **Adoption risk**: Existing plans/brainstorms won't have user goals. b-build's flag and b-save's warning will surface these naturally.
- **Overhead risk**: The user goal prompt could feel like ceremony for obvious tasks. Mitigated by the agent synthesizing from context rather than demanding explicit input.
