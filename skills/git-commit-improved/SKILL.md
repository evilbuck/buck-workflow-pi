---
name: git-commit-improved
description: Deterministic Conventional Commits — code-driven counterpart to the git-commit skill. Reads a draft-commit.md (or drafts via the model), commits in line, cleans up the draft, and verifies. No agent-interpreted prose for the git plumbing.
---

# git-commit-improved: deterministic Conventional Commit

Companion skill to `git-commit`. The whole flow is orchestrated in code by
`extensions/b-commit-improved/index.ts` (Pi/OMP) or via the cross-platform
fallback in `commands/b-commit-improved.md`. This skill is the contract —
the extension is the deterministic implementation.

## Inputs

- Staged changes only. Do not infer work from unstaged or untracked files.
- A draft-commit.md if present in the active subject folder or `.context/`. The
  subject folder is the most recently modified `.context/YYYY-MM-DD.*/` directory.
- Additional user context (free-form text in the slash-command arguments).
- **`--force`** — bypass the protected-branch check (`main`, `master`, `dev`, `develop`).
  Use deliberately; exists for hotfixes and emergencies.
- **`--no-draft`** — skip reading a draft; force the inline model-draft path.
- **`--dry-run`** — preview only; never mutate. If the message came from the
  model, the draft is written so the user can re-run. If a pre-existing draft
  was found, leave it untouched.
- **`--model <provider/id>`** — override the default model for the draft step.

## Safety Rules

- Never commit to `main`, `master`, `dev`, or `develop` unless `--force` is set.
- If nothing is staged, do not commit. Stage changes first.
- Never commit a message that contains the literal `$TITLE` or `$BODY` placeholder.
- On commit failure, retry once if a hook auto-staged new files; otherwise
  surface the error and stop without deleting the draft.

## Procedure

The deterministic path lives in `extensions/b-commit-improved/index.ts`. Run it
through Pi/OMP with `/b-commit-improved [args]`, or under any agent that loads
this skill directly with `bun <skill_dir>/../extensions/b-commit-improved/index.ts`
(loaded by the runtime — the skill itself does not orchestrate the git work).

For cross-platform usage without the extension, follow the procedure in
`skills/git-commit/SKILL.md` exactly — this skill codifies the same contract
deterministically.
