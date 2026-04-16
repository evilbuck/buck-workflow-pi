---
description: Create a Conventional Commits message and run git commit
---

# Git Commit

Create a Conventional Commits message from staged changes and commit immediately.

## Inputs

- Staged changes only. Do not infer work from unstaged or untracked files.
- Utilize any staged memory or spec files in `.context/memory/` or `.context/specs/` as guidance, but verify the work was done.
- Optional user context: $ARGUMENTS

## Safety rules

- Never commit to or merge into these branches: `main`, `master`, `develop`.
- If the current branch is one of those, stop and instruct the user to create/switch to a feature branch.
- Do not stage files automatically. If nothing is staged, stop and tell the user to stage changes first.

## Procedure

1. **Gather current state**:

   - Branch + working tree: `git status -sb`
   - Staged file list: `git diff --cached --name-only`
   - Staged diff (patch): `git diff --cached`
   - Recent commits (style reference): `git log -10 --oneline`

2. If the current branch is protected (`main`/`master`/`develop`), do not commit.

3. If there are no staged changes, do not commit.

4. Determine the best Conventional Commits type (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, etc.).

5. Draft a commit message:

   - Title: `<type>(<optional scope>): <short summary>` (<= 72 chars)
   - Body: 1-3 lines focusing on why, key constraints, and notable behavior changes.
   - If breaking change, include `BREAKING CHANGE:` in the body.

6. Commit immediately with the generated message:

    First, verify your drafted message doesn't contain placeholder tags:
    - Title should NOT contain the string `$TITLE`
    - Body should NOT contain the string `$BODY`

    Use multiple `-m` flags for multi-line messages. If no body is needed, use a single `-m` with just the title.
    Example (replace with your actual values):
    ```bash
    git commit -m "feat(scope): my actual title" -m "My actual body line 1

    My actual body line 2"
    ```

7. **ONLY run if the commit in step 6 actually failed**:

    Check if git commit failed:
    - If commit succeeded, skip to step 8
    - If commit failed (exit code != 0) AND there are staged changes remaining:
      - Run `git status -sb`
      - Stage only the hook-modified files: `git add <files>`
      - Re-run the commit with the same actual message
    - If commit failed but no new staged changes, report the error and stop

8. **Verify** the commit was created correctly:

    ```bash
    git log -1 --format='%B'
    ```

    If the message contains literal `$TITLE` or `$BODY`:
    - Amend with the correct message:
    ```bash
    git commit --amend -m "actual title" -m "actual body"
    ```
    - Report this as a warning

9. Show results:

   - `git status -sb`
   - `git log -1 --oneline`

## Output

- Print the final commit message used (title + body).
- Include the important lines from the post-commit status/log.
