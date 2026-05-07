---
description: Create a Conventional Commits message and run git commit
---

# Git Commit

Create a Conventional Commits message from staged changes and commit immediately.

## Inputs

- Staged changes only. Do not infer work from unstaged or untracked files.
- Utilize any staged memory or spec files in `.context/memory/` or `.context/specs/` as guidance, but verify the work was done.
- Additional user context (if any): $ARGUMENTS

## Safety rules

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

5. **If no draft was found**, determine the best Conventional Commits type and draft a commit message:

   - Title: `<type>(<optional scope>): <short summary>` (<= 72 chars)
   - Body: 1-3 lines focusing on why, key constraints, and notable behavior changes.
   - If breaking change, include `BREAKING CHANGE:` in the body.

6. Commit immediately with the message (from draft or just drafted):

    First, verify your message doesn't contain placeholder tags:
    - Title should NOT contain the string `$TITLE`
    - Body should NOT contain the string `$BODY`

    Use multiple `-m` flags for multi-line messages. If no body is needed, use a single `-m` with just the title.
    Example (replace with your actual values):
    ```bash
    git commit -m "feat(scope): my actual title" -m "My actual body line 1

    My actual body line 2"
    ```

7. **Clean up draft**: Delete the draft from whichever path it was found at (subject folder or root) after successful commit.

8. **ONLY run if the commit in step 6 actually failed**:

    Check if git commit failed:
    - If commit succeeded, skip to step 9
    - If commit failed (exit code != 0) AND there are staged changes remaining:
      - Run `git status -sb`
      - Stage only the hook-modified files: `git add <files>`
      - Re-run the commit with the same actual message
    - If commit failed but no new staged changes, report the error and stop

9. **Verify** the commit was created correctly:

    ```bash
    git log -1 --format='%B'
    ```

    If the message contains literal `$TITLE` or `$BODY`:
    - Amend with the correct message:
    ```bash
    git commit --amend -m "actual title" -m "actual body"
    ```
    - Report this as a warning

10. Show results:

   - `git status -sb`
   - `git log -1 --oneline`

## Output

- Print the final commit message used (title + body).
- Include the important lines from the post-commit status/log.
