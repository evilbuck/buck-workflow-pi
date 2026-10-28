---
title: "Fix branch identity collision in git-cleanup classifier"
status: completed
priority: high
created: 2026-10-27
updated: 2026-10-27
completed: 2026-10-27
related:
  - .context/2026-10-26.git-cleanup-skill/phase-1-classify-json.md
  - .context/2026-10-26.git-cleanup-skill/iterate-phase-1-refname-collision-review.md
  - skills/git-cleanup/scripts/classify.ts
  - skills/git-cleanup/scripts/classify.test.ts
---

# Fix branch identity collision in git-cleanup classifier

`skills/git-cleanup/scripts/classify.ts` uses `%(refname:short)` as the canonical branch identity. When a tag name collides with a branch name, Git emits the branch in a longer form (`heads/main` instead of `main`), so:

- the integration-branch skip check misses the integration branch, and
- worktree deduplication compares identities from two different namespaces.

Reproduced in a disposable repository with a tag named `main` and a branch named `main`: the classifier emitted an item `heads/main` with `disposition: auto-delete`, `skip_reason: null`, `contained: true`.

## Acceptance criteria

- [x] Branch inventory uses full `%(refname)` and strips exactly `refs/heads/`, so identity is one namespace
- [x] The integration branch is `skip` when a tag of the same name exists
- [x] Worktree deduplication uses the same canonical identity as branch inventory
- [x] Regression tests cover the tag/branch collision for integration protection and for worktree deduplication
- [x] `npx vitest run skills/git-cleanup/scripts/classify.test.ts` and `npm run guardrails:check` pass

Completed 2026-10-27. `parseBranches` now reads full `%(refname)` values and strips only `refs/heads/`; worktree branch identities already use that same namespace. A regression fixture creates a `main` tag while checking out `feature`, then verifies the unassigned integration branch appears exactly once as a `branch` row with `disposition: skip` and `skip_reason: integration`. Focused classifier tests (26/26), durable guardrails, and a read-only CLI smoke passed.
