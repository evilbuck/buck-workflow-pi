---
status: active
date: 2026-05-18
subject: 2026-05-18.buck-checkpoints
topics: [checkpoints, git, workflow, automation, b-build, b-phase, b-review]
research: []
iterations: []
spec: null
memory: []
---

# Plan: Buck Workflow Checkpoints

## Goal

Add automatic Git commit checkpoints at natural workflow boundaries in the Buck workflow — specifically at the end of `b-build` and at the end of each completed phase in `b-phase`. Each checkpoint is a real `git commit` on the working branch, using the existing Conventional Commits message format with a `[checkpoint]` marker. Commits only fire on successful completion; failures leave no commit.

## Context used / assumptions

- User-provided context: brainstorm draft in `.context/2026-05-18.buck-checkpoints/brainstorm-buck-checkpoints.md`
- Session context: user wants real git commits (not stash-like), fires at phase boundaries, user can still manually commit whenever
- Artifacts used: brainstorm draft + existing skill files (`b-build/SKILL.md`, `b-phase/SKILL.md`, `b-review/SKILL.md`, `b-iterate/SKILL.md`, `git-commit/SKILL.md`)
- Assumptions / open questions resolved:

| Open Question (from brainstorm) | Decision |
|---|---|
| Where does checkpoint logic live? | New `b-checkpoint` skill — decoupled, called by `b-build` |
| Checkpoint marker format? | `[checkpoint]` suffix in commit body; `checkpoint:` prefix in title |
| Should `b-build` checkpoint? | Yes — build completion is a natural boundary |
| Interaction with `b-review`? | Review → iterate (if needed) → review passes → checkpoint commit. Review always before commit. |
| What about `b-iterate`? | No checkpoint per iteration. Checkpoint fires only after the full review→iterate→review cycle completes. |
| Phase metadata in commits? | Yes — commit body includes phase number/name when in phased mode |
| Dirty state / `git add` scope? | Only stage files the agent touched (tracked via session memory "Files Modified" section), not `git add .` |

## Scope

In scope:
1. Create `skills/b-checkpoint/SKILL.md` — new skill for checkpoint commits
2. Update `skills/b-build/SKILL.md` — add checkpoint invocation in closeout and phase state updates
3. Update `skills/b-review/SKILL.md` — clarify checkpoint happens after review passes
4. Update `skills/b-iterate/SKILL.md` — clarify no checkpoint per iteration; defer to build/phase closeout
5. Update `skills/git-commit/SKILL.md` — add checkpoint-aware message format handling

Out of scope:
- Changes to `b-brainstorm`, `b-plan`, `b-grill`, `b-present`, `b-research`
- New CLI commands or Pi prompt templates (those are thin wrappers, updated separately)
- Automatic branch management or protected branch handling (git-commit skill already handles this)
- Checkpoint rollback or undo tooling
- Changes to the Buck workflow plugin extension code

## Affected files

| File | Change type |
|---|---|
| `skills/b-checkpoint/SKILL.md` | **New file** — core checkpoint skill |
| `skills/b-build/SKILL.md` | Edit closeout + phase state updates to invoke checkpoint |
| `skills/b-review/SKILL.md` | Edit output section to clarify checkpoint flow |
| `skills/b-iterate/SKILL.md` | Edit closeout section — defer to checkpoint |
| `skills/git-commit/SKILL.md` | Add checkpoint-aware message format handling |

## Implementation steps

### Step 1: Create `b-checkpoint` skill

Create `skills/b-checkpoint/SKILL.md` with:

- **Invocation**: Called by `b-build` — after phase completion (phased plans) or after build closeout (single-pass builds)
- **Input**: Active subject folder path, session memory file (for list of modified files), phase metadata (if applicable)
- **Procedure**:
  1. Read session memory file to get "Files Modified" list
  2. Stage only those files: `git add <file1> <file2> ...`
  3. Check for dirty state — if user has uncommitted changes outside the modified list, warn but proceed (only staging agent-touched files)
  4. Generate checkpoint commit message (see Step 6 for format)
  5. Run `git commit -m "<title>" -m "<body>"`
  6. Verify commit succeeded; report commit hash + message
  7. Clean up `draft-commit.md` if present (stage + amend)
- **Failure behavior**: If commit fails, do nothing — no partial state. Report error.
- **Protected branches**: Inherit git-commit safety rules (no commit to main/master/develop)

### Step 2: Update `b-build` closeout

In the "Closeout" section of `skills/b-build/SKILL.md`, after step 4 (draft commit message), add:

- New step 5: "Invoke checkpoint: Run `/skill:b-checkpoint` with the current subject folder and session context"
- Update step 5 → 6: "Recommendation" — change from "then `/b-save`" to "then `/b-review` → checkpoint → `/b-save`"
- The full new closeout flow: changed files → verification → draft commit → **checkpoint commit** → recommend `/b-save`

### Step 3: Update `b-build` phase execution

`b-phase` only creates phase files — `b-build` actually executes them. In `skills/b-build/SKILL.md`, in the "Phased Plan Awareness" → "Phase State Updates (Required)" section, after step 4d (note the next phase to execute), add:

- New step 5: "Invoke checkpoint: After phase completion is recorded, run `/skill:b-checkpoint` to commit this phase's work"

Also update the "Closeout" section of `b-build` to note that checkpoint fires before the final closeout report, so the flow is: phase complete → record state → checkpoint commit → report to user.

### Step 4: Update `b-review` flow

In `skills/b-review/SKILL.md`:

- Add a "Post-Review Flow" note: When review passes with no issues, the next step is checkpoint commit, not manual commit
- Update "When review passes" output to mention: "Run `/skill:b-checkpoint` to commit this phase's work"
- Clarify that checkpoint commits happen **after** review approval, never before

### Step 5: Update `b-iterate` closeout

In `skills/b-iterate/SKILL.md`:

- Change closeout step 5 from "Run `/b-save` to finalize this session's record, or `/git-commit` to commit" to: "Run `/b-review` to re-validate, then `/skill:b-checkpoint` to commit, then `/b-save` to finalize"
- Make it clear: iterations don't produce their own checkpoint commits — the checkpoint fires when the parent build/phase cycle completes

### Step 6: Checkpoint commit message format

In `skills/git-commit/SKILL.md` (or in `b-checkpoint` itself), define the checkpoint message format:

```
## Title
checkpoint: <type>(<scope>): <short summary>

## Body
<why this change was made>
<key constraints, notable behavior changes>

[checkpoint] <phase info if applicable>
```

Examples:
```
checkpoint: feat(auth): add login flow

Added OAuth login with Google and GitHub providers.

[checkpoint] b-build complete
```

```
checkpoint: feat(api): add user endpoints

Implemented CRUD endpoints for user resource.

[checkpoint] Phase 2 of 4: API Endpoints (complete)
```

The `checkpoint:` prefix makes these easy to filter in `git log --grep="checkpoint:"`. The `[checkpoint]` suffix in the body provides human-readable context.

## Verification

1. **Skill file validity**: Each new/modified skill file follows the existing SKILL.md format with frontmatter
2. **Flow integrity**: The end-to-end flow (build → review → iterate → checkpoint → save) is documented and internally consistent across all skill files
3. **No circular dependencies**: `b-checkpoint` calls `git commit` directly; no skill calls back to its caller
4. **Edge case coverage**: Protected branch check, dirty state handling, failure behavior all specified
5. **Cross-reference consistency**: Updated skills reference each other correctly (b-build → b-checkpoint, b-review → b-checkpoint)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| User has uncommitted changes that get partially staged | Medium | Low | Only stage files from session memory "Files Modified" list; warn user |
| Checkpoint commit on protected branch | Low | High | Inherit git-commit's protected branch guard |
| Commit fails mid-workflow (no disk space, hooks reject) | Low | Medium | No partial state — if commit fails, work remains unstaged |
| Session memory "Files Modified" is stale or incomplete | Medium | Medium | Fall back to `git diff` against last commit if memory file is missing |
| Skills get out of sync (e.g., b-build says checkpoint, but b-checkpoint doesn't exist) | Low | High | All changes shipped in one commit; skills reference each other |
| b-review finds issues after checkpoint | Low | Medium | b-review runs **before** checkpoint — this is a design invariant |

## Recommended next step

This plan touches 5 files (1 new, 4 edits) across a single architectural layer (skill files). It's bounded and straightforward.

**Run `/b-build`** to implement.
