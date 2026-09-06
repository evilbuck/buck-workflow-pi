---
name: b-commit
description: Create a Conventional Commit after Buck Workflow has saved durable session context. Use when the user asks to checkpoint completed, staged workflow work in git.
---

# B-Commit

Follow the sibling `git-commit` skill. Before committing, confirm the session's durable context has been recorded with `$b-save` when that workflow applies.

Pass `force` only when the user explicitly authorizes a commit to a protected branch.
