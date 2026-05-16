---
name: b-build
description: Implement well-defined work with the smallest safe code change. Use /b-build for straightforward work or /b-build-hard for complex, ambiguous, or higher-risk implementation. The skill adapts behavior based on difficulty level.
---

# b-build: Implementation Agent

Implement well-defined work with the smallest safe code change. Difficulty adapts behavior:

- **standard** (`/b-build`): Follow existing patterns, keep scope tight, read related files and tests before editing.
- **hard** (`/b-build-hard`): Think through trade-offs before editing, break changes into safe steps, preserve behavior unless change is required, surface risks and migration concerns clearly, run stronger verification.

## Difficulty Levels

### Standard (default)

- Follow existing patterns.
- Keep scope tight.
- Read related files and tests before editing.
- Run appropriate verification.
- Report changed files, assumptions, and results.

### Hard

- Think through trade-offs before editing.
- Break changes into safe steps.
- Preserve behavior unless change is required.
- Surface risks and migration concerns clearly.
- Run stronger verification than standard.
- Output includes: implementation summary, changed files, verification results, risks/trade-offs, recommended next step.

## Context Resolution

Before building, check for prior planning artifacts using this **resolution order**:

1. **Active subject folder** (from session context): `.context/YYYY-MM-DD.[:subject]/plan-*.md`, `spec-*.md`
2. **All subject folders** (scan for active entities): `.context/*/plan-*.md`, `*/spec-*.md`
3. **Flat directories** (legacy fallback): `.context/plans/*.md`, `.context/specs/active/*.md`
4. **Backlog** (always): `.context/backlog/todo.md` (legacy fallback: `.context/backlog.md`)

### Cross-Reference Following

When you load a plan, also read its linked artifacts:
- **Plan's `research:` field** → read the research files for context
- **Plan's `spec:` field** → read the spec to verify requirements
- **Spec's `plans:` field** → verify coverage (for b-review)

### Subject Folder Note

If you start building without a subject folder (ad-hoc work), **b-save will create one** at session end and consolidate artifacts. You don't need to manage this — just focus on implementation.

If a plan exists, follow its implementation steps and affected files list. If a spec exists, verify the implementation satisfies its requirements.

## Phased Plan Awareness

If a `plan-*-phases.md` file exists in the subject folder:

1. **Read it** and identify the current active phase (first non-completed phase in the summary table).
2. **Read the discrete phase file** linked in the summary table for full implementation details.
3. **Surface the model hint** — tell the user at the start:
   > **Phase N: <name>** — difficulty: `<easy|medium|hard>` — model hint: `<description>` — executing via `/b-build` or `/b-build-hard`
4. **Difficulty mismatch**:
   - **Standard mode, hard phase**: Warn the user:
     > ⚠️ This phase is rated **hard**. Consider switching to `/b-build-hard` for stronger reasoning.
     If the user confirms they want to proceed with standard, continue normally.
   - **Hard mode, easy/medium phase**: Mention it but proceed — the user explicitly chose hard for a reason (risk tolerance, extra verification, etc.).
5. **Scope to the active phase only** — implement only the current phase's steps and acceptance criteria, not the entire plan.
6. **After completing the phase**, note which phase was finished and suggest the next step (queue next phase, run `/b-review`, or `/b-save`).

### Phase State Updates (Required)

When working on a phased plan with discrete phase files:

1. **At start**: Read the phases overview to find the active phase (first non-completed). Read that phase file.
2. **Mark phase in-progress**: Update the phase file's frontmatter `status: in-progress`.
3. **Implement**: Execute only the current phase's scope.
4. **On completion**:
   a. Update acceptance criteria checkboxes in the phase file: `[ ]` → `[x]`
   b. Set `status: completed` and `completed_at: YYYY-MM-DD` in phase file frontmatter
   c. Update the phases overview file (`plan-*-phases.md`): change the phase's status from `pending`/`in-progress` to `completed` in the summary table
   d. Note the next phase to execute
5. Tell the user which phase was completed and what's next.

### Legacy Phased Plans

If the phases overview has no `format: discrete` frontmatter (legacy single-file format), use the old behavior: scan `## Phase N` sections and check inline acceptance criteria. No discrete phase files to update.

## Session Awareness Protocol

The Buck workflow plugin tracks your session automatically. You are responsible for the living memory — the plugin handles the rest.

At the START of your work:
1. Read `.context/workflow/current-session.json` if it exists
2. Read the memory file listed in session state (if any) for prior context

At EACH NATURAL STOP (you finished a coherent unit of work):
3. Read the current session memory file
4. Rewrite it in-place with consolidated, current information:
   - Add new decisions made since last update
   - Move abandoned approaches to an "Abandoned Approaches" section with reasons
   - Update "Files Modified" to reflect actual current state
   - Remove duplicates and superseded entries
   - Update frontmatter topics/domains if scope shifted
5. If no memory file exists yet, create one with proper frontmatter and record its path in current-session.json under memory_file

At COMPLETION:
6. Do a final memory update
7. Tell the user: "Run /b-save to finalize this session's record."

## Escalation

- **Standard → Hard**: Escalate to `b-build-hard` if the task becomes ambiguous, architectural, or spreads beyond the expected files. Also escalate if the active phase in a phased plan is rated **hard**.
- **Any → Review**: Escalate to `b-review` when implementation is ready for validation.

## Closeout

After completing implementation, report:
1. **Changed files** — list what was modified
2. **Verification** — confirm the changes work
3. **Phase status** — if working from a phased plan, note which phase was completed
4. **Draft commit message** — write the draft to the active subject folder (e.g. `.context/YYYY-MM-DD.subject/draft-commit.md`). If no subject folder exists yet, write to `.context/draft-commit.md` at the root. Include a Conventional Commits message based on the staged changes:

   ```markdown
   ## Title
   <type>(<scope>): <short summary>

   ## Body
   <why this change was made, key constraints, notable behavior changes>
   ```

5. **Recommendation** — suggest `/b-review` for validation, then `/b-save` to finalize
