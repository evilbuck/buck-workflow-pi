---
status: completed
date: 2026-05-18
updated: 2026-05-18
subject: 2026-05-18.buck-checkpoints
topics: [review, iteration, checkpoint, b-flow]
informs: []
addresses: plan-buck-checkpoints.md
completed: 2026-05-18
from_review: b-review
---

# Iteration: Buck Checkpoints

## Source
- Reviewed after: `/b-build`
- Plan: `plan-buck-checkpoints.md`
- Spec: none

## Critical Issues

### 1. `opts.subject` is accepted but never used
- **File**: `extensions/b-flow/checkpoint.ts`
- **Problem**: The function signature accepts `subject?: string | null` and the caller in `index.ts` passes `snapshot.context.subject`, but `createCheckpointCommit` ignores it entirely. Step 1 always discovers the subject folder by running `ls -td .context/????-??-??.*/ | head -1` — picking the **most recently modified** folder. If two subject folders exist, this picks the wrong one.
- **Proped fix**: Use `opts.subject` to resolve the directory directly when provided:
  ```
  if (opts.subject) {
    subjectDir = join(".context", opts.subject);
  } else {
    // fallback: ls -td discovery
  }
  ```
  Ensure the resolved path exists before proceeding.

## Warnings

### 1. `git add -A` stages everything, contradicting plan
- **File**: `extensions/b-flow/checkpoint.ts` (~line 66)
- **Problem**: Plan says "Only stage files the agent touched (tracked via session memory 'Files Modified' section)". Implementation uses `git add -A` which stages **all** changes including unrelated user modifications and untracked files.
- **Suggested approach**: Use `git add -u` (stages modified/deleted tracked files only — no untracked) as a safer default. Full agent-file tracking can be a follow-up.

### 2. Unused variable `pathsArg` in step 9
- **File**: `extensions/b-flow/checkpoint.ts` (~line 90)
- **Problem**: `const pathsArg = draftFiles.map(...)` is computed but the inline `draftFiles.map(...)` expression is used in the `execSync` call instead. Dead code.
- **Suggested approach**: Remove the `pathsArg` variable, keep the inline expression.

### 3. Shell injection risk in commit message interpolation
- **File**: `extensions/b-flow/checkpoint.ts` (~line 76)
- **Problem**: Title and body are interpolated into a shell string. Double-quote escaping handles `"` but backticks, `$()`, etc. could break the command.
- **Suggested approach**: Write commit message to a temp file and use `git commit -F <file>`, or use `execFileSync` with args array.

### 4. git-commit skill references non-existent b-checkpoint skill
- **File**: `skills/git-commit/SKILL.md`
- **Problem**: Description says "Checkpoint commits (from b-checkpoint)" but b-checkpoint skill was scrapped. Checkpoint logic lives in `checkpoint.ts` now.
- **Suggested approach**: Update reference to "Checkpoint commits (from b-flow checkpoint)".

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
