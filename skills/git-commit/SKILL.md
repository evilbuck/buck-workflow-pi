---
name: git-commit
description: Create a Conventional Commits message from staged changes and commit immediately. Standalone utility that also integrates with Buck workflow via draft-commit.md artifacts and deterministic preflight plumbing.
---

# git-commit: Conventional Commit Agent

Durable Buck artifacts are addressed through `workflow_state` or `bun skills/_shared/scripts/workflow-state-cli.ts`, per `skills/_shared/workflow-state-access.md`. The logical names below are the artifact identity. A `.context/` path is only the repo-files projection, not a required input. Do not construct SQL or call `sql_memory`.

Create a Conventional Commits message from staged changes and commit immediately. Works standalone or as part of the Buck workflow (reads `draft-commit.md` if present).

Buck workflow invokes this skill through `/b-commit` (the workflow-facing slash command) or `/b-commit-improved` (the deterministic extension-backed path in `extensions/b-commit-improved/index.ts`, which uses `skills/git-commit/scripts/commit-preflight.ts`). The skill name remains `git-commit` because it is the generic, reusable implementation.

## Inputs

- Staged changes only. Do not infer work from unstaged or untracked files.
- Utilize any staged memory or spec files in `.context/memory/` or `.context/specs/` as guidance, but verify the work was done.
- Additional user context (if provided).
- **`force` / `--force`** — if present in arguments (e.g. `/b-commit force`, `/b-commit-improved --force`), override the protected-branch restriction and allow committing directly to `main`, `master`, `dev`, or `develop`. Use deliberately — this exists for hotfixes and emergencies.
- **`--no-draft`** — skip reading a draft; force inline drafting from the staged diff.
- **`--dry-run`** — preview only; never mutate git history. If a message was drafted from the model, write `draft-commit.md` so the user can re-run; leave any pre-existing draft untouched.
- **`--model <provider/id>`** — override the default model when running via `/b-commit-improved`.

## Safety Rules

- Never commit to or merge into these branches: `main`, `master`, `dev`, `develop` — **unless `force` / `--force` is specified** (see Inputs).
- If the current branch is protected and `force` / `--force` is NOT specified, stop and instruct the user to create/switch to a feature branch (or re-run with `force`).
- Do not stage files automatically. If nothing is staged, stop and tell the user to stage changes first.
- Never commit a message that contains `$TITLE`, `$BODY`, or leftover `<short summary>`. Unfilled drafts use `$TITLE` / `$BODY` sentinels only.

## Deterministic Preflight Script

`skills/git-commit/scripts/commit-preflight.ts` provides deterministic git/draft inspection (`bun skills/git-commit/scripts/commit-preflight.ts [--force] [--no-draft] [--dry-run]`):
- Exit `0`: ready to commit (`current_branch`, `subject_folder`, `draft_path`, `draft`, `staged_files`, `diff`).
- Exit `2`: protected branch (`main`, `master`, `dev`, `develop`) and `--force` not set.
- Exit `3`: nothing staged.
- Exit `1`: git error (not a repo, detached HEAD).

Under Pi/OMP with `extensions/b-commit-improved/index.ts` loaded, `/b-commit-improved` orchestrates this preflight, model drafting, commit, draft cleanup, and verification in code. For `/b-commit` or cross-platform usage without the extension, follow the procedure below.

## Scoped orchestration commit

When the caller supplies `Commit scope`, use the named disposable detached worktree and checkpoint. Verify the target branch is eligible, the scratch checkout is detached at the expected parent, and `git write-tree` matches the expected tree. Bypass draft discovery, draft cleanup, staging, and amend. Run normal `git commit` in the scratch checkout, with hooks enabled. Verify its tip is a single-parent commit matching that parent and tree. Return the verified SHA or report the mismatched SHA and tree while they are still detached. The supervisor alone promotes a verified commit and reconciles the live index. Standalone calls use the procedure below.

## Procedure

1. **Check for draft commit message** (unless `--no-draft` is passed):

   Run `bun skills/git-commit/scripts/commit-preflight.ts` (or find the active subject folder — the most recently modified `.context/YYYY-MM-DD.*/` directory):
   ```bash
   ls -dt .context/????-??-??.*/ 2>/dev/null | head -1
   ```
   If a subject folder exists, read `.context/<subject>/draft-commit.md`. If that doesn't exist, fall back to `.context/draft-commit.md`.

   If a draft exists and contains a non-empty `## Title` without `$TITLE` / `<short summary>` placeholders:
   - Use it directly — **skip diff analysis entirely**.
   - Proceed to step 5 with the drafted message.
   - After successful commit, delete the draft from whichever path it was found at.

2. **Fallback: gather current state** (only if no usable draft exists):

   - Branch + working tree: `git status -sb`
   - Staged file list: `git diff --cached --name-only`
   - Staged diff (patch): `git diff --cached`
   - Recent commits (style reference): `git log -10 --oneline`

3. If the current branch is protected (`main`/`master`/`dev`/`develop`) **and `force` / `--force` is NOT specified**, do not commit. Warn the user and suggest creating a feature branch or re-running with `force`.

4. If there are no staged changes, do not commit.

5. **Draft the commit message** (from draft or just drafted):

   Determine the best Conventional Commits type and draft a commit message:
   - Title: `<type>(<optional scope>): <short summary>` (<= 72 chars)
   - Body: 1-3 lines focusing on why, key constraints, and notable behavior changes.
   - If breaking change, include `BREAKING CHANGE:` in the body.
   - If `--dry-run` is set, preview the message and stop here without running `git commit`.

6. **Commit NOW:**

   Use the Bash tool to run `git commit` immediately. This is NOT a dry run. Do NOT output the command as a suggestion. Do NOT wrap it in a code block. Do NOT ask the user to run it themselves. Run it. Right now.
   - Title should NOT contain `$TITLE` or leftover `<short summary>`
   - Body should NOT contain `$BODY`

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

    If the message contains `$TITLE`, `$BODY`, or leftover `<short summary>`:
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
