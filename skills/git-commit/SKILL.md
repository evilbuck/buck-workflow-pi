---
name: git-commit
description: Create a Conventional Commits message from staged changes and commit immediately. Standalone utility that also integrates with Buck workflow via draft-commit.md artifacts. Checkpoint commits (from b-flow's `checkpoint.ts`) use `checkpoint:` as the Conventional Commits type with `[checkpoint]` in the body to distinguish them in git history.
---

# git-commit: Conventional Commit Agent

Create a Conventional Commits message from staged changes and commit immediately. Works standalone or as part of the Buck workflow (reads draft-commit.md if present).

## Inputs

- Staged changes only. Do not infer work from unstaged or untracked files.
- Utilize any staged memory or spec files in `.context/memory/` or `.context/specs/` as guidance, but verify the work was done.
- Additional user context (if provided).

## Safety Rules

- Never commit to or merge into these branches: `main`, `master`, `develop`.
- If the current branch is one of those, stop and instruct the user to create/switch to a feature branch.
- Do not stage files automatically. If nothing is staged, stop and tell the user to stage changes first.

## Procedure

1. **Check for draft commit message**:

   Find the active subject folder — the most recently modified `.context/YYYY-MM-DD.*/` directory:
   ```bash
   ls -dt .context/????-??-??.*/ 2>/dev/null | head -1
   ```
   If a subject folder exists, read `.context/<subject>/draft-commit.md`. If that doesn't exist, fall back to `.context/draft-commit.md`.

   If a draft exists and contains a non-empty `## Title`:
   - Use it directly — **skip diff analysis entirely**.
   - Proceed to step 5 with the drafted message.
   - After successful commit, delete the draft from whichever path it was found at.

2. **Fallback: gather current state** (only if no draft exists):

   - Branch + working tree: `git status -sb`
   - Staged file list: `git diff --cached --name-only`
   - Staged diff (patch): `git diff --cached`
   - Recent commits (style reference): `git log -10 --oneline`

3. If the current branch is protected (`main`/`master`/`develop`), do not commit.

4. If there are no staged changes, do not commit.

5. **Draft the commit message** (from draft or just drafted):

   Determine the best Conventional Commits type and draft a commit message:
   - Title: `<type>(<optional scope>): <short summary>` (<= 72 chars)
   - Body: 1-3 lines focusing on why, key constraints, and notable behavior changes.
   - If breaking change, include `BREAKING CHANGE:` in the body.
   - **Checkpoint commits** (invoked from b-flow's checkpoint.ts): use `checkpoint:` as the type, e.g. `checkpoint(b-build): complete phase 1` with `[checkpoint]` as the first line of the body.

6. **Commit NOW:**

   Use the Bash tool to run `git commit` immediately. This is NOT a dry run. Do NOT output the command as a suggestion. Do NOT wrap it in a code block. Do NOT ask the user to run it themselves. Run it. Right now.
   - Title should NOT contain the string `$TITLE`
   - Body should NOT contain the string `$BODY`

   Use multiple `-m` flags for multi-line messages. If no body is needed, use a single `-m` with just the title.
   ```bash
   git commit -m "feat(scope): my actual title" -m "My actual body line 1

   My actual body line 2"
   ```

7. **Clean up draft**: Delete the draft from whichever path it was found at (subject folder or root) after successful commit.

8. **Stage and amend**: After deleting the draft, stage the deletion and amend the commit to include it:
   ```bash
   git add <draft-path>
   git commit --amend --no-edit
   ```

9. **ONLY run if the commit in step 6 actually failed**:

   Check if git commit failed:
   - If commit succeeded, skip to step 10
   - If commit failed (exit code != 0) AND there are staged changes remaining:
     - Run `git status -sb`
     - Stage only the hook-modified files: `git add <files>`
     - Re-run the commit with the same actual message
   - If commit failed but no new staged changes, report the error and stop

10. **Verify** the commit was created correctly:
    ```bash
    git log -1 --format='%B'
    ```

    If the message contains literal `$TITLE` or `$BODY`:
    - Amend with the correct message:
    ```bash
    git commit --amend -m "actual title" -m "actual body"
    ```
    - Report this as a warning

11. Show results:
    ```bash
    git status -sb
    git log -1 --oneline
    ```

## Output

- Print the final commit message used (title + body).
- Include the important lines from the post-commit status/log.
