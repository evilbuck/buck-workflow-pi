---
date: 2026-10-12
domains: [workflow-state, confinement]
topics: [symlink-write, project-binding, git-metadata]
related: []
priority: high
status: active
subject: 2026-10-10.durable-storage-adapters
artifacts:
  - iterate-phase-4-native-access-boundary.md
  - draft-commit.md
---

# Phase 4 child boundary iteration

Dangling and intermediate symlink writes are rejected by the delivered SDK write/edit tools. The sink opens checkout components with `O_NOFOLLOW`, so a link swap after the pre-check cannot create an outside file.

`restrictedChildTools` resolves one trusted context and passes it into `workflow_state`. Later Git origin changes do not rebind that child. `.git` paths, including worktree git files, are not writable by non-commit file tools. Commit isolation still uses the existing read-write Git bind.

Receipt privacy on a real branch switch remains with a freshly resolved tool. A tool created before checkout keeps its original binding.
