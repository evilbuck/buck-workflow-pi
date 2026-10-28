---
name: git-clean-orphans
description: Alias of git-cleanup — deletes proven-landed clean local branches and registered worktrees (containment-proven, including after squash, rebase, or rewritten history), then asks keep-or-delete for everything else. Use for local Git housekeeping under the old name.
---

Proven-landed clean branches are deleted without the old confirmation pause. A checkout outside the main repository's parent is no longer skipped when it is registered to this common Git directory.

# git-clean-orphans → `git-cleanup`

This skill is a redirect. There is exactly one local delete procedure, and it lives in `git-cleanup`. Load and follow that skill in full:

```
../git-cleanup/SKILL.md
```

Everything the old ancestry-and-always-confirm procedure did by hand is replaced by the classifier and its apply path there. Do not keep a second inventory, a second confirmation flow, or any hand-written deletion command in this file.
