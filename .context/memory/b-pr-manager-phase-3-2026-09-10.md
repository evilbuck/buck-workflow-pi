---
date: 2026-09-10
domains: [extensions, github, testing]
topics: [b-pr-manager, gh, fingerprint, auto-merge, phase-3]
related: [b-pr-manager-phase-2-2026-09-10.md]
priority: high
status: completed
subject: 2026-09-10.b-pr-manager
---

Phase 3: `extensions/b-pr-manager/github.ts`. Injectable `gh` runner. Auto-merge is `gh pr merge --auto --<method>` never `--admin`. Fingerprint = id + updatedAt + sha256(content). Tests 6/6 fake-gh.
