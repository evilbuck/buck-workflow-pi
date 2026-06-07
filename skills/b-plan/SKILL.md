---
name: b-plan
description: Turn user-provided context, session context, and optional artifacts into a bounded implementation plan with scope, risks, and verification. Use when the user wants a formal, structured plan.
---

# b-plan: Planning Agent

Turn the user's request into a bounded implementation plan using:

- explicit context provided in the request,
- existing context already established in the session,
- optional brainstorm/research/spec artifacts,
- and relevant code you inspect.

**Do not require an existing `research-*.md` file to proceed.**

## Write Boundary

- You may write to `.context/**` and temporary scratch locations using native file tools (write/edit).
- Save plans where the user can reuse them outside the context window.
- Do not modify source files outside `.context/`.
- **Allowed**: Native `write` and `edit` tools for `.context/**` files.
- **Allowed**: Bash commands for `.context/**` directory operations (mkdir, find, cat, ls).
- **Blocked**: Bash redirects (`>`) and file modifications outside `.context/**`.

## Subject Folder Creation (Required)

**Every b-plan session creates a subject folder.** This is not opt-in.

1. **Infer subject name** from the conversation topic (kebab-case)
2. **Create dated folder**: `.context/YYYY-MM-DD.<subject-name>/`
3. **Create `index.md`** with `status: active` (plan now exists, work is underway)
4. **Write plan file inside**: `plan-<topic>.md`

**Example:**
```
.context/
└── 2026-04-08.auth-feature/
    ├── index.md    ← status: active
    └── plan-oauth-login.md
```

## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If the protocol resolves a subject, use it for all downstream artifact discovery.
If the protocol finds no subject, proceed as a fresh session.

After subject resolution, gather planning context from these additional sources:

1. **Explicit user context** — the current request, pasted notes, links, constraints, examples, desired outcomes, and any files the user points at
2. **Session context** — prior messages, prior decisions, referenced files, and already-established assumptions in this chat
3. **Relevant subject-folder artifacts** — check the chosen subject folder for:
   - `index.md` — **read this first** if it exists; it links all other artifacts in the subject
   - `brainstorm-*.md` or `plan-draft-*.md`
   - `research-*.md` (from either `b-explore` or `b-research`)
   - `spec-*.md`
   - existing `plan-*.md` when refining or replacing a plan
4. **Relevant code** — read the code/config/tests needed to make the plan concrete

Use these sources together. Artifacts are helpful inputs, not prerequisites.

## Clarification Interview Protocol

If the work definition is ambiguous, underspecified, or hiding important tradeoffs:

1. Ask targeted follow-up questions before finalizing the plan.
2. Prefer one question at a time; if needed, ask a short batch of tightly related questions.
3. Focus on missing information that changes the plan: user goal (who benefits, what changes for them), goals, constraints, non-goals, success criteria, rollout, verification, dependencies, or risk tolerance.
4. **User goal gate**: if the plan has no `## User Goal` and the user has not waived with an explicit "technical chore", ask for one before finalizing. See the [User Goal Requirement](#user-goal-requirement) for details.
5. If the user wants to move forward without answering everything, proceed with explicit assumptions and list open questions in the plan.

## Cross-Reference Stitching

When creating a plan:

1. Check for related artifacts in the chosen subject folder.
2. **Research is optional**:
   - If relevant `research-*.md` files exist and informed the plan, populate the plan's `research:` field with those filenames
   - Back-fill each research file's `informs:` field to include this plan
3. **Brainstorm is optional**:
   - If a `brainstorm-*.md` or draft file exists, use it as planning input
   - Capture its useful conclusions in the plan body under `Context used / assumptions`
4. **Iterations (from b-review findings):**
   - If relevant `iterate-*.md` files exist in the subject folder, populate the plan's `iterations:` field with those filenames
   - Back-fill each iteration file's `informs:` field to include this plan
5. **If implementing a spec:**
   - Populate the plan's `spec:` field with the spec filename
   - The spec's `plans:` array will be updated by b-save after execution
6. **If no artifacts exist**, continue using the user's provided context, session context, and code reading. Do not block or require `/b-research` first.

## Behavior

- Read the relevant code before deciding.
- Combine user-provided context, session context, and any relevant artifacts.
### User Goal Requirement

Every plan MUST include a `## User Goal` section immediately after the title. The user goal is the user-facing north star — *who* benefits from this work and *what* changes for them.

Behavior:
- If the user provided a user goal, record it verbatim under `## User Goal`.
- If the upstream brainstorm (`b-brainstorm`) defined one, carry it forward.
- If neither, **synthesize** a draft from the user's loose requirements and ask them to confirm or refine before finalizing.
- The user may waive with an explicit "technical chore" — record `Technical chore — <reason>` so the waiver is visible to downstream skills (`b-build`, `b-review`, `b-phase`, `b-save`).
- This section is **REQUIRED**. Plans without it are incomplete. Do not finalize a plan that lacks `## User Goal` (or an explicit waiver) — if the user resists, surface it as a gap, not a silent omission.

Downstream skills read the user goal as the user-facing intent. A missing user goal is a visible gap in the plan, not a stylistic preference.

- Interview the user when clarification is needed to make the plan bounded and actionable.
- Define scope, out-of-scope, affected files, assumptions, risks, and verification.
- Write tactical implementation plans as `plan-*.md` in the subject folder.
- Write strategic specs as `spec-*.md` in the subject folder (for multi-session epics/PRDs).
- If a spec already exists in the subject folder, reference it in the plan.
- Create backlog items only for **clear near-term actionable units** of work that emerge from the plan. One backlog item = one pickup-able unit of work. Do not auto-expand specs/plans into a large queue.
- When creating backlog items: create the backing item file `.context/backlog/items/<slug>.md` with frontmatter (`title`, `status: active`, `priority`, `created`, `updated`, `completed: null`, `related`) and add a linked checkbox to `.context/backlog/todo.md`. If only `.context/backlog.md` exists (legacy), use that format instead.
- Recommend `b-build` for straightforward work and `b-build-hard` for ambiguous or high-risk work.
- Recommend `b-explore` when missing code or architecture understanding prevents a good plan.
- Recommend `b-research` when missing external information (APIs, libraries, documentation) prevents a good plan.
- **Recommend `b-phase`** if the plan exceeds any of these thresholds:
  - More than ~8 implementation steps
  - Touches more than ~5 distinct files or directories
  - Spans multiple architectural layers (DB + API + UI)
  - Involves high-risk paths (auth, billing, data migrations)
  - Contains significant unknowns or research spikes
  - Verification alone would exhaust a single session
  - Phrasing: *"This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to break it into sequential Ralph-ready phases with dependency analysis, per-phase model hints, and resume-safe execution instructions."*
- If the user wants Ralph automation but the plan does **not** need phasing, keep the plan non-phased and add a minimal **Ralph Instructions** section for the single-unit cycle: `/b-build` → `/b-review` → `/b-iterate` if needed → `/b-save` → `/git-commit` → `ralph_done`.

## Plan Frontmatter Template

```yaml
---
status: active
date: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
topics: [keyword, list]
research: [research-file.md]  # Research that informed this plan (if any)
iterations: [iterate-*.md]     # Iteration artifacts from b-review (if any)
spec: spec-file.md            # Spec this plan implements (if any)
memory: []                    # Filled by b-save after execution
---
```

## Non-Phased Ralph Plans

Not every Ralph-run task needs `b-phase`. If the plan is small enough for one build/review cycle but the user wants Ralph to drive it, add a short **Ralph Instructions** section to the plan itself. Treat the whole plan as one unit and use the same durable mini-cycle documented in `b-phase`'s Ralph Instructions Template.

Recommended wording:

```markdown
## Ralph Instructions

This is a non-phased Ralph-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` (or `/b-build-hard` if ambiguity appears) against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/git-commit` to checkpoint durable state before `ralph_done`.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next iteration.
```

## Recommended Plan Structure

```markdown
# Plan: <title>

## User Goal
<who benefits and what changes for them, or: Technical chore — <reason>>

## Goal
...

## Context used / assumptions
- User-provided context: ...
- Session context: ...
- Artifacts used: ...
- Assumptions / open questions: ...

## Scope
...

## Out of scope
...

## Affected files
...

## Implementation steps
1. ...

## Verification
- ...

## Ralph Instructions
<!-- Optional: include when the user wants Ralph execution on a non-phased plan. Reference b-phase's Ralph Instructions Template and use the single-unit cycle. -->

## Risks
- ...
```

## Output

If you need clarification first:

```text
Clarification needed
What is ambiguous
Question(s) for the user
```

After saving a plan:

```text
Goal
Scope / out of scope
Affected files
Implementation steps
Verification
Inputs used: [user context, session context, brainstorm: X, research: Y, spec: Z]
Subject folder created: .context/YYYY-MM-DD.<subject>/
Plan saved: plan-<topic>.md
Recommended next step
```
