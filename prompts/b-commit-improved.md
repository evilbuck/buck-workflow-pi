---
description: Deterministic Conventional Commits — code-driven counterpart to b-commit. Reads a draft-commit.md (or drafts via the model), commits in line, cleans up the draft, and verifies.
---

# B-Commit-Improved

$ARGUMENTS

Under Pi/OMP with the `b-commit-improved` extension loaded, this slash command
runs the deterministic code path (`extensions/b-commit-improved/index.ts`).
Without it, load the `git-commit-improved` skill and follow it manually:

```
../skills/git-commit-improved/SKILL.md
```

The skill encodes the same contract: protected-branch guard, draft-or-model
flow, commit in line, draft cleanup + amend, verify. Args mirror the extension:
`--force`, `--no-draft`, `--dry-run`, `--model <provider/id>`.
