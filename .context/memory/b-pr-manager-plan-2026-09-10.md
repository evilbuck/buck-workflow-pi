---
date: 2026-09-10
domains:
  - extensions
  - workflow
  - github
topics:
  - b-pr-manager
  - pull-request-automation
  - review-feedback
  - state-machine
  - auto-merge
related:
  - .context/2026-09-10.b-pr-manager/plan-b-pr-manager.md
  - .context/backlog/items/b-pr-manager.md
priority: high
status: completed
subject: 2026-09-10.b-pr-manager
artifacts:
  - plan-b-pr-manager.md
  - index.md
---

# b-pr-manager planning

## Outcome

Planned `/b-pr-manager`, a narrow OMP extension that drives one open pull request from complete review-feedback intake through bounded Buck fix/review rounds, safe rebase and push, progress-sensitive polling, auto-merge, and fresh GitHub confirmation of the merged state.

## Decisions

- Keep semantic work model-driven: feedback validation, code evidence, fix planning, edits, conflict content, and independent review.
- Keep control and side effects deterministic: PR/base identity, pagination, state transitions, timing, persistence, checks, commits, pushes, merge gates, and success.
- Use a dedicated XState v5 machine rather than reviving the deprecated general `b-flow` runtime.
- Reuse `/b-pr-improved`'s `.git/b-pr-base` cache. Missing or mismatched cache requires an upfront selection before checkout/rebase mutation.
- Require exact-head Buck review, no actionable unresolved feedback, green required checks, and the repository's branch-protection review decision. Add no extra approval policy.
- Enable auto-merge only after the deterministic gate passes; never use admin bypass; only GitHub `MERGED` is success.
- Default polling is one immediate gate observation plus seven delayed polls at 30s, 60s, 120s, 240s, 480s, 600s, and 600s (35m30s delayed total). Real progress resets decay.
- Persist runtime checkpoints under the worktree gitdir so recovery does not dirty the PR.

## Verification

- Plan contract validation passed all 14 required checks: active frontmatter, immediately stated user goal, scope boundary, affected files, ten implementation steps, acceptance criteria, verification contract, deterministic/LLM/hybrid ownership, Mermaid state graph, base-cache reuse, force-with-lease safety, bounded polling, merged-only success, and phase handoff.
- The plan contains 398 lines and explicitly covers no-feedback, valid-feedback, conflict, new-comment, pending-gate, cancellation, exhaustion, resume, and confirmed-merge paths.
- This session changed only Markdown under `.context/`; the deterministic code check contract is therefore not applicable.

## Repository state

The target worktree was already on `feat/deterministic-b-save` with unrelated untracked `.context/2026-09-10.b-save-state-machine-analysis/` and `.context/discussions/`. Those paths were not modified.

## Next

Run `/skill:b-phase .context/2026-09-10.b-pr-manager/plan-b-pr-manager.md`, then execute the resulting phases with `/skill:b-build` and review each phase with `/skill:b-review`.
